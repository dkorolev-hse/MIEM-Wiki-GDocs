/*
* API Post request handler
* Handle requests of two resource types: page and user
*/
function doPost(e) {
    if(typeof e !== 'undefined' && e.postData.type === 'application/json' && !!e.postData.contents) {
        var params = JSON.stringify(e);
        var requestBody = JSON.parse(e.postData.contents);
        switch (requestBody.resource) {
            case 'page':
                return processResourcePage(requestBody);
                break;
            case 'user':
                return processResourceUser(requestBody);
                break;
            default:
                return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unable to proccess unknown resource:' + requestBody.resource}));
                break;
        }
    }
}

/*
* Process requests of page resource
*/
function processResourcePage(requestBody) {
  var doc;
  var status = 'error';
  
  if (requestBody.action === 'update' && !!requestBody.fileId) {
    doc = DocumentApp.openById(requestBody.fileId);
    status = 'updated';
  }
  if (requestBody.action === 'create' || !doc) {
    doc = DocumentApp.create('Wiki Page: ' + requestBody.pageTitle);
    status = 'created';
    var driveFile = DriveApp.getFileById(doc.getId());
    driveFile.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
  }
  var body = doc.getBody();
  body.setText('');
  buildDocFromContent(body, requestBody.pageContent)
  return ContentService.createTextOutput(JSON.stringify({ status: status, fileId: doc.getId()}));
}

/*
* Process requests of user resource
* When user is created, add Editor to all provided Google Documents by Google Doc Id
*/
function processResourceUser(requestBody) {
  var status = 'error';
  if (requestBody.action === 'add_document') {
    if (!requestBody.docId) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unable to proccess: "docId" required'}));
    } 
    var doc = DocumentApp.openById(requestBody.docId);
    doc.addEditor(requestBody.email);
    status = 'success';
  }
  return ContentService.createTextOutput(JSON.stringify({ status: status, fileId: doc.getId()}));
}

/*
* Build document body from JSON representation of DOM, which is generated on Wikimedia side
*/
function buildDocFromContent(body, pageContent) {

    // Context of current iteration
    var context = { attr: {} };
    context.attr[DocumentApp.Attribute.FONT_SIZE] = 11;
    context.attr[DocumentApp.Attribute.ITALIC] = false;
    context.attr[DocumentApp.Attribute.BOLD] = false;

    // Headings mapping to Google Docs Headings
    var headings = {
        'h1': DocumentApp.ParagraphHeading.HEADING1,
        'h2': DocumentApp.ParagraphHeading.HEADING2,
        'h3': DocumentApp.ParagraphHeading.HEADING3,
        'h4': DocumentApp.ParagraphHeading.HEADING4,
        'h5': DocumentApp.ParagraphHeading.HEADING5,
        'h6': DocumentApp.ParagraphHeading.HEADING6
    };

    // Text style attributes mapping
    var text_attr = {
        'i': { key: DocumentApp.Attribute.ITALIC, value: true },
        'b': { key: DocumentApp.Attribute.BOLD, value: true },
        'big': { key: DocumentApp.Attribute.FONT_SIZE, value: 12 },
        'small': { key: DocumentApp.Attribute.FONT_SIZE, value: 10 },
        'dt': { key: DocumentApp.Attribute.BOLD, value: true }
    };
    var text_align = {
        'sup': DocumentApp.TextAlignment.SUPERSCRIPT,
        'sub': DocumentApp.TextAlignment.SUBSCRIPT
    };
    // List style mapping
    var glyph_type = {
        'ul': 'BULLET',
        'ol': 'NUMBER'
    };
    var definition_indent = {
        'dt': 36,
        'dd': 40
    };

    /*
    * Add paragraph to Google Doc
    */
    function addParagraph (context, elements, content) {
        var permitted = [
            DocumentApp.ElementType.BODY_SECTION,
            DocumentApp.ElementType.TABLE_CELL,
            DocumentApp.ElementType.TABLE_OF_CONTENTS,
            DocumentApp.ElementType.HEADER_SECTION,
            DocumentApp.ElementType.FOOTER_SECTION,
            DocumentApp.ElementType.FOOTNOTE_SECTION
        ];
        var PARENT = elements.ROOT;
        if (permitted.indexOf(elements.PARENT.getType()) > -1) {
            PARENT = elements.PARENT;
        }
        content.html = content.html || '';
        content.html = content.html.replace(/^[\r\n]{2,}/g, '');
        content.html = content.html.replace(/^[\t]/g, '');
        content.html = content.html.replace(/[\r\n]{2,}$/g, '\n');
        content.html = content.html.replace(/[\t]{2,}$/g, '\t');
        content.html = content.html.replace(/[\s]+/g, ' ');
        PARENT = PARENT.appendParagraph(content.html.trim());
        PARENT.setAttributes(context.attr);
        return PARENT;
    }

    // Add text to Google Doc
    function addText (context, elements, content) {
        var permitted = [
            DocumentApp.ElementType.TABLE_CELL,
            DocumentApp.ElementType.EQUATION,
            DocumentApp.ElementType.EQUATION_FUNCTION,
            DocumentApp.ElementType.LIST_ITEM,
            DocumentApp.ElementType.PARAGRAPH
        ];
        var PARENT = elements.PARENT;
        if (permitted.indexOf(PARENT.getType()) === -1) {
            PARENT = addParagraph(context, elements, { html: '' });
        }
        var TEXT = PARENT.editAsText();

        if (text_attr[content.tag]) {
            context.attr[text_attr[content.tag].key] = text_attr[content.tag].value;
        }
        if (text_align[content.tag]) {
            context.textAlignment = text_align[content.tag];
        }
        if (content.html) {
            content.html = content.html.replace(/[\s]+/g, ' ');
            var start = TEXT.getText().length;
            if (content.html.trim() === '') {
                TEXT.appendText(content.html);
            } else {
                TEXT.appendText(content.html.replace(/^\s+/,"") + ' ');
            }

            TEXT.setAttributes(start, start + content.html.length - 1, context.attr);
            TEXT.setTextAlignment(start, start + content.html.length - 1, context.textAlignment);
            if (content.tag === 'a' && content.href) {
                TEXT.setLinkUrl(start, start + content.html.length - 1, content.href);
            } else {
                TEXT.setLinkUrl(start, start + content.html.length - 1, null);
            }
        }
        return PARENT;
    }

    // Add heading to google doc
    function addHeading (context, elements, content) {
        var PARENT = elements.PARENT;
        if (PARENT.getType() !== DocumentApp.ElementType.PARAGRAPH || PARENT.getText().length > 0) {
            PARENT = addParagraph(context, elements, content);
        }
        PARENT.setHeading(headings[content.tag]);
        return PARENT;
    }

    // Prepare context to add ListItems
    function addListContainer (context, elements, content) {
        var permitted = [
            DocumentApp.ElementType.BODY_SECTION,
            DocumentApp.ElementType.TABLE_CELL,
            DocumentApp.ElementType.TABLE_OF_CONTENTS,
            DocumentApp.ElementType.HEADER_SECTION,
            DocumentApp.ElementType.FOOTER_SECTION,
            DocumentApp.ElementType.FOOTNOTE_SECTION
        ];
        var PARENT = elements.ROOT;
        if (permitted.indexOf(elements.PARENT.getType()) > -1) {
            PARENT = elements.PARENT;
        }

        if (context.list.nesting === null){
            context.list.nesting = 0;
        } else {
            context.list.nesting += 1;
        }
        context.list.glyph = 'BULLET';
        if (glyph_type[content.tag]) {
            context.list.glyph = glyph_type[content.tag];
        }
        return PARENT;
    }

    // Add List item to Google Doc
    function addListItem (context, elements, content) {

        var permitted = [
            DocumentApp.ElementType.BODY_SECTION,
            DocumentApp.ElementType.TABLE_CELL,
            DocumentApp.ElementType.TABLE_OF_CONTENTS,
            DocumentApp.ElementType.HEADER_SECTION,
            DocumentApp.ElementType.FOOTER_SECTION,
            DocumentApp.ElementType.FOOTNOTE_SECTION
        ];
        var PARENT = elements.ROOT;
        if (permitted.indexOf(elements.PARENT.getType()) > -1) {
            PARENT = elements.PARENT;
        }
        PARENT = PARENT.appendListItem(content.html || '');
        PARENT.setNestingLevel(context.list.nesting);
        if (DocumentApp.GlyphType[context.list.glyph]) {
            PARENT.setGlyphType(DocumentApp.GlyphType[context.list.glyph]);
        }
        return PARENT;
    }
    function addDefinitionItem (context, elements, content) {
        if (text_attr[content.tag]) {
            context.attr[text_attr[content.tag].key] = text_attr[content.tag].value;
        }
        var PARENT = addParagraph(context, elements, content);
        PARENT.setIndentStart(definition_indent[content.tag] * context.list.nesting);
        PARENT.setIndentFirstLine(definition_indent[content.tag] * context.list.nesting);

        return PARENT;
    }

    // Add table to Google Doc
    function addTable (context, elements, content) {
        var permitted = [
            DocumentApp.ElementType.BODY_SECTION,
            DocumentApp.ElementType.TABLE_CELL,
            DocumentApp.ElementType.HEADER_SECTION,
            DocumentApp.ElementType.FOOTER_SECTION
        ];
        var PARENT = elements.ROOT;
        if (permitted.indexOf(elements.PARENT.getType()) > -1) {
            PARENT = elements.PARENT;
        }
        PARENT = PARENT.appendTable();
        if (content.class && content.class.split(' ').indexOf('wikitable') > -1) {
            context.table.class = content.class;
            PARENT.setBorderColor('#a2a9b1');
            PARENT.setBorderWidth(1);
        } else {
            PARENT.setBorderColor('#ffffff');
            PARENT.setBorderWidth(0);
        }
        return PARENT;
    }

    // Add Table Row to Google Doc
    function addTableRow (context, elements, content) {
        var PARENT = elements.ROOT;
        if (elements.PARENT.getType() === DocumentApp.ElementType.TABLE) {
            PARENT = elements.PARENT;
        }
        PARENT = PARENT.appendTableRow();
        return PARENT;
    }

    // Add Table Cell to Google Doc
    function addTableCell (context, elements, content) {
        var PARENT = elements.ROOT;
        if (elements.PARENT.getType() === DocumentApp.ElementType.TABLE_ROW) {
            PARENT = elements.PARENT;
        }
        if (content.html) {
            PARENT = PARENT.appendTableCell(content.html.trim());
        } else {
            PARENT = PARENT.appendTableCell();
        }

        if (context.table.class === 'wikitable') {
            if (content.tag === 'th') {
                PARENT.setBackgroundColor('#eaecf0');
            }
            if (content.tag === 'tr') {
                PARENT.setBackgroundColor('#f8f9fa');
            }
        }
        return PARENT;
    }

    /*
    * Recursive function for walk through DOM and add elements to Google Doc
    */
    function traversePageContent(ctx, elements, content) {
        var PARENT = elements.PARENT;
        var ROOT = elements.ROOT;

        var attr = (ctx.attr) ? JSON.parse(JSON.stringify(ctx.attr)) : {};
        var textAlignment = ctx.textAlignment || DocumentApp.TextAlignment.NORMAL;
        var listStyle = (ctx.list) ? JSON.parse(JSON.stringify(ctx.list)) : { nesting: null, glyph: 'BULLET' };
        var tableStyle = (ctx.table) ? JSON.parse(JSON.stringify(ctx.table)) :  { class: null };
        var context = { attr: attr, textAlignment: textAlignment, list: listStyle, table: tableStyle };

        if (content.tag === 'html' || content.tag === 'body') {
            return traversePageContent(context, elements, content.children[0]);
        }

        // Call functions for DOM elements
        switch (content.tag) {
            case 'div':
                if (content.class === 'toc') return;
                if (content.class !== 'mw-parser-output') return;
                break;
            // PARAGRAPH
            case 'p':
                PARENT = addParagraph(context, elements, content);
                break;
            // BOLD & ITALIC
            case 'b':
            case 'i':
            case 'big':
            case 'small':
            case 'sub':
            case 'sup':
            case 'span':
            case 'a':
                PARENT = addText(context, elements, content);
                break;
            case 'br':
                PARENT = addText(context, elements, { tag: 'br', html: '\n' });
                break;
            // HEADINGS
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                if (content.children !== undefined && content.children.length > 0) {
                    for (var k = 0; k < content.children.length; k++) {
                        if (content.children[k].class === 'mw-headline') {
                            content = {
                                tag: content.tag,
                                html: content.children[k].html
                            };
                            break;
                        }
                    }
                }
                PARENT = addHeading(context, elements, content);
                break;
            case 'ul':
            case 'ol':
            case 'dl':
                addListContainer(context, elements, content);
                break;
            case 'li':
                if (content.class === 'gallerybox') {
                    return;
                }
                PARENT = addListItem(context, elements, content);
                break;
            case 'dt':
            case 'dd':
                PARENT = addDefinitionItem(context, elements, content);
                break;
            case 'table':
                PARENT = addTable(context, elements, content);
                break;
            case 'tr':
                PARENT = addTableRow(context, elements, content);
                break;
            case 'th':
            case 'td':
                PARENT = addTableCell(context, elements, content);
                break;
            case 'img':
                var blob = UrlFetchApp.fetch('http://wikiwork.site' + content.src).getBlob();
                PARENT.appendInlineImage(blob);
                break;
            default:
                // element.appendParagraph(JSON.stringify(content));
                break;
        }

        var glyph = DocumentApp.GlyphType[context.list.glyph];
        if (content.children && content.children.length > 0) {
            var isList = (['ul', 'dl', 'ol'].indexOf(content.tag) > -1);
            for (var i = 0; i < content.children.length; i++) {
                if (isList && ['span', 'br'].indexOf(content.children[i].tag) > -1) {
                    continue;
                }
                traversePageContent(context, { ROOT: ROOT, PARENT: PARENT }, content.children[i]);
            }
        }
        if (content.tag === 'li') {
            PARENT.setGlyphType(glyph);
        }
    }
    traversePageContent(context, { ROOT: body, PARENT: body }, pageContent);
}
