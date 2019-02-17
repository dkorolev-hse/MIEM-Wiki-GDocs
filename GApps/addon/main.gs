/**
 * @OnlyCurrentDoc
 *
 * The above comment directs Apps Script to limit the scope of file
 * access for this add-on. It specifies that this add-on will only
 * attempt to read or modify the files in which the add-on is used,
 * and not all of the user's files. The authorization request message
 * presented to users will reflect this limited scope.
 */

function onOpen(e) {
    setupMenu();
}

function setupMenu() {
    DocumentApp.getUi()
        .createAddonMenu()
        .addItem('Публикация', 'showSidebarPublish')
        .addItem('Аккаунт wiki', 'showSidebarAccount')
        .addToUi();
}

function getWikiUrl () {
    return 'http://wikiwork.site';
}


function onInstall(e) {
    onOpen(e);
}


function getOAuthService() {
    var service = OAuth1.createService('wikiwork')
        .setAccessTokenUrl(getWikiUrl() + '/index.php?title=Special:OAuth/token')
        .setRequestTokenUrl(getWikiUrl() + '/index.php?title=Special:OAuth/initiate')
        .setAuthorizationUrl(getWikiUrl() + '/index.php?title=Special:OAuth/authorize')
        // Set the consumer key and secret.
        .setConsumerKey('29cee129a261ebbb3c183bc009aebff3')
        .setConsumerSecret('e57548321bf841ec18621109b1db1c3ce0f07b43')
        // Set the name of the callback function in the script referenced
        // above that should be invoked to complete the OAuth flow.
        .setCallbackFunction('authCallback')
        .setPropertyStore(PropertiesService.getUserProperties())
        .setOAuthVersion('1.0a');
    return service;
}

function authCallback(request) {
    var service = getOAuthService();
    var authorized = service.handleCallback(request);
    var t = HtmlService.createTemplateFromFile('auth_callback_template');
    t.ok = !!authorized;
    return t.evaluate();
}

function performLogout() {
    var service = getOAuthService();
    service.reset();
    setupMenu();
    showSidebarSignIn();
}

function onLoginDone() {
    var service = getOAuthService();
    setupMenu();
    showSidebarAccount();
}

function showSidebarPublish() {
    var service = getOAuthService();

    if (service.hasAccess()) {
        // show user name and publishing interface
        var doc = DocumentApp.getActiveDocument();
        var response = service.fetch(getWikiUrl() + '/api.php?format=json&action=googledocsid&google_docs_id=' + doc.getId());
        try {
            var obj = JSON.parse(response.getContentText());

            var t = HtmlService.createTemplateFromFile('sidebar_publish_template');
            if (obj.googledocsid.status === 'found') {
                t.data = {
                    found: true,
                    page: {
                        title: obj.googledocsid.item.title,
                        url: getWikiUrl() + '/index.php?title=' + obj.googledocsid.item.title
                    }
                };
            } else if (obj.googledocsid.status === 'not_found') {
                t.data = {
                    found: false,
                };
            }
            var ui = t.evaluate();
            ui.setTitle('Wiki Publish');
            DocumentApp.getUi().showSidebar(ui);
        } catch (e) {
            showSidebarSignIn(e);
        }
    } else {
        showSidebarSignIn();
    }
}

function showSidebarSignIn(error) {
    var service = getOAuthService();
    service.reset();
    var authorizationUrl = service.authorize();
    var t = HtmlService.createTemplateFromFile('sidebar_signin_template');
    t.data = {
        auth_url: authorizationUrl,
        error: error
    }
    var ui = t.evaluate();
    ui.setTitle('Wiki SignIn');
    DocumentApp.getUi().showSidebar(ui);
}

function showSidebarAccount() {
    var service = getOAuthService();
    if (service.hasAccess()) {
        var t = HtmlService.createTemplateFromFile('sidebar_account_template');
        t.data = {
            wiki_url: uiGetWikiUrl(),
            wiki_jwt: uiGetWikiJwt()
        };
        var ui = t.evaluate();
        ui.setTitle('Wiki Account');
        DocumentApp.getUi().showSidebar(ui);
    } else {
        showSidebarSignIn();
    }
}

function uiGetWikiUrl() {
    return getWikiUrl();
}

function uiGetWikiJwt() {
    var service = getOAuthService();
    if (service.hasAccess()) {
        var url = getWikiUrl() + '/index.php?title=Special:OAuth/identify';
        var response = service.fetch(url);
        return response.getContentText();
    }
}

function fetchEditToken() {
    var service = getOAuthService();
    if (service.hasAccess()) {
        var response = service.fetch(getWikiUrl() + '/api.php?action=query&meta=tokens&format=json&type=csrf');
        var result = JSON.parse(response.getContentText());
        return result.query.tokens.csrftoken;
    } else {
        return null;
    }
}

function doPublish(summary, isMinor) {
    var service = getOAuthService();

    if (service.hasAccess()) {
        var doc = DocumentApp.getActiveDocument();
        // show user name and publishing interface

        var response = service.fetch(getWikiUrl() + '/api.php?format=json&action=googledocsid&google_docs_id=' + doc.getId());
        var obj = JSON.parse(response.getContentText());

        var editToken = fetchEditToken();

        var params = {
            method: 'post'
        };
        var body = doc.getBody();
        params.payload = {
            "action": "edit",
            "format": "json",
            "title": obj.googledocsid.item.title,
            "text": makeWikitext({}, body),
            "summary": summary,
            "minor": isMinor,
            "basetimestamp": "now",
            "token": editToken
        };

        response = service.fetch(getWikiUrl()+'/api.php', params);
    }
}

function makeWikitext(ctx, item) {
    var context = ctx;
    if (!context.list) {
        context.list = { nesting: [] };
    } else {
        if (!context.list.nesting) {
            context.list.nesting = [];
        }
    }

    var res = '';

    switch (item.getType()) {
        case DocumentApp.ElementType.BODY_SECTION:
            res += getChildrenText(context, item);
            break;
        case DocumentApp.ElementType.INLINE_IMAGE:
            var blob = uploadImageToWIki(item);
            res += '[[File:'+blob.getName()+'|'+item.getWidth()+'x'+item.getHeight()+'px|alt='+item.getAltDescription()+'|'+item.getAltTitle()+']]';
            res += '<br/>\n';
            break;
        case DocumentApp.ElementType.LIST_ITEM:
            var listType = getListType(item.getGlyphType());
            var list_prefix = context.list.nesting.slice(0, item.getNestingLevel()).join('') + listType;
            if (item.getNestingLevel() + 1 > context.list.nesting.length) {
                context.list.nesting.push(listType);
            } else if (item.getNestingLevel() + 1 < context.list.nesting.length) {
                context.list.nesting = context.list.nesting.slice(0, item.getNestingLevel());
                context.list.nesting.push(listType);
            }
            res += list_prefix + ' ' + getChildrenText(context, item) + '\n';
            break;
        case DocumentApp.ElementType.PARAGRAPH:
            switch (item.getHeading()) {
                case DocumentApp.ParagraphHeading.HEADING1:
                    break;
                case DocumentApp.ParagraphHeading.HEADING2:
                    res = '== ' + item.getText() + ' ==\n';
                    break;
                case DocumentApp.ParagraphHeading.HEADING3:
                    res = '=== ' + item.getText() + ' ===\n';
                    break;
                case DocumentApp.ParagraphHeading.HEADING4:
                    res = '==== ' + item.getText() + ' ====\n';
                    break;
                case DocumentApp.ParagraphHeading.HEADING5:
                    res = '===== ' + item.getText() + ' =====\n';
                    break;
                case DocumentApp.ParagraphHeading.HEADING6:
                    res = '====== ' + item.getText() + ' ======\n';
                    break;
                default:
                    var text = getChildrenText(context, item);
                    res += text.replace(/\n{1}/g, '\n\n').trim() + '\n\n';
                    break;
            }
            break;
        case DocumentApp.ElementType.TABLE:
            res += getTable(context, item);
            break;
        case DocumentApp.ElementType.TEXT:
            res += getFormatedText(context, item);
            break;
        default:
            break;
    }
    return res;
}

function getTable(ctx, table) {
    var res = '';
    for (var rowsIndex = 0; rowsIndex < table.getNumChildren(); rowsIndex++) {
        var row = table.getChild(rowsIndex);
        res += '\n|-\n| ';
        var cels = [];
        for (var celsIndex = 0; celsIndex < row.getNumChildren(); celsIndex++) {
            var cel = row.getChild(celsIndex);
            cels.push(getChildrenText(ctx, cel).replace(/[\s]+$/g, ''));
        }
        res += cels.join(' || ');
    }
    return '{| class="wikitable" ' + res + '\n|}';
}


function getChildrenText(ctx, item) {
    var res = '';
    var childCount = item.getNumChildren();
    for (var childIndex = 0; childIndex < childCount; childIndex++) {
        res += makeWikitext(ctx, item.getChild(childIndex));
    }
    return res;
}

function getFormatedText(ctx, item) {
    var text = item.getText();
    var partIndexes = item.getTextAttributeIndices();

    partIndexes.push(text.length);

    var res = '';
    for (var i = 0; i < partIndexes.length-1; i++) {
        var substr = text.substring(partIndexes[i], partIndexes[i+1]);
        var atts = item.getAttributes(partIndexes[i]);

        var alignment = item.getTextAlignment(partIndexes[i]);

        var styled = false;

        for (var att in atts) {
            if (atts[att] !== null) {
                styled = true;
            }
            switch (att) {
                case 'BACKGROUND_COLOR':
                    break;
                case 'BOLD':
                    if (atts[att] === true) {
                        substr = "'''" + substr + "'''";
                    }
                    break;
                case 'FONT_SIZE':
                    if (atts[att] === null) {
                        break;
                    } else if (atts[att] > 11) {
                        substr = '<big>' + substr + '</big>';
                    } else if (atts[att] < 11) {
                        substr = '<small>' + substr + '</small>';
                    }
                    break;
                case 'ITALIC':
                    if (atts[att] === true) {
                        substr = "''" + substr + "''";
                    }
                    break;
                case 'LINK_URL':
                    if (atts[att] && atts[att].length > 0) {
                        substr = "[" + atts[att] + " " + substr + "]";
                    }
                    break;
                case 'STRIKETHROUGH':
                    if (atts[att] === true) {
                        substr = "<s>" + substr + "</s>";
                    }
                    break;
                case 'UNDERLINE':
                    if (atts[att] === true) {
                        substr = "<u>" + substr + "</u>";
                    }
                    break;
                default:
                    break;
            }
        }
        switch (alignment) {
            case DocumentApp.TextAlignment.SUPERSCRIPT:
                substr = '<sup>' + substr + '</sup>';
                break;
            case DocumentApp.TextAlignment.SUBSCRIPT:
                substr = '<sub>' + substr + '</sub>';
                break;
        }
        res += substr;
    }
    return res;
}

function uploadImageToWIki(image) {
    var service = getOAuthService();
    var boundary = "9VakuZGPfV6AfhfyKG4XJaNaN";

    var blob = image.getBlob();

    var ext = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/gif': 'gif'
        }[blob.getContentType()] || 'png';

    blob.setName('Image-' + Date.now() + '.' + ext);

    var requestBody = Utilities.newBlob(
        "--"+boundary+"\r\n"
        + "Content-Disposition: form-data; name=\"action\"\r\n\r\n"
        + "upload\r\n"+"--"+boundary+"\r\n"
        + "Content-Disposition: form-data; name=\"format\"\r\n\r\n"
        + "json\r\n"+"--"+boundary+"\r\n"
        + "Content-Disposition: form-data; name=\"filename\"\r\n\r\n"
        + blob.getName()+"\r\n"+"--"+boundary+"\r\n"
        + "Content-Disposition: form-data; name=\"token\"\r\n\r\n"
        + fetchEditToken()+"\r\n"+"--"+boundary+"\r\n"
        + "Content-Disposition: form-data; name=\"ignorewarnings\"\r\n\r\n"
        + "true\r\n"+"--"+boundary+"\r\n"
        + "Content-Disposition: form-data; name=\"file\"; filename=\""+blob.getName()+"\"\r\n"
        + "Content-Type: " + blob.getContentType()+"\r\n\r\n").getBytes()
        .concat(blob.getBytes())
        .concat(Utilities.newBlob("\r\n--"+boundary+"--\r\n").getBytes());

    var params = {
        method: "post",
        contentType: "multipart/form-data; boundary="+boundary,
        payload: requestBody,
        muteHttpExceptions: true,
    };

    var response = service.fetch(getWikiUrl()+'/api.php', params);
    return blob;
}

function getListType(glyph) {
    switch (glyph) {
        case DocumentApp.GlyphType.BULLET:
        case DocumentApp.GlyphType.HOLLOW_BULLET:
        case DocumentApp.GlyphType.SQUARE_BULLET:
            return '*';
            break;
        case DocumentApp.GlyphType.NUMBER:
        case DocumentApp.GlyphType.LATIN_UPPER:
        case DocumentApp.GlyphType.LATIN_LOWER:
        case DocumentApp.GlyphType.ROMAN_UPPER:
        case DocumentApp.GlyphType.ROMAN_LOWER:
        default:
            return '#';
            break;
    }
}