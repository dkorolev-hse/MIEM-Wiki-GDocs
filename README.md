# Docs2Wiki mediawiki extension

Mediawiki extension and Google Apps Scripts (Addon + Standalone API) to edit wiki page content in Google doc and sync with mediawiki.

## Requirements
* [Mediawiki](https://www.mediawiki.org/wiki/MediaWiki) (version 1.32.x) and [OAuth extension](https://www.mediawiki.org/wiki/Extension:OAuth) ([installation steps](docs/how-to-deploy-mediawiki.md));
* Chrome Webstore Developer account (one time 5$ fee to confirm developer account).

## Installation Steps

### 1. Deploy Standalone API (to Google's cloud)
1. Create project "Docs2Wiki API" on [GSuite Developer Hub](https://script.google.com/home);
2. Copy files from GApps/api to project (create files with same names as in repository and copy-paste content);
3. Deploy as web app. Follow [instructions](https://developers.google.com/apps-script/guides/web#deploying_a_script_as_a_web_app).
   - **NOTE:** *Current web app URL* will be used below
   - **Warning**: Docs2Wiki Standalone API requests project owner access to Google Drive in order to store Google Docs;

### 2. Install MediaWiki's Docs2Wiki extension
0. Install MediaWiki and OAuth extension. Follow [instructions](docs/how-to-deploy-wikimedia.md) (optional, skip if installed)
1. Copy extensions/Docs2Wiki;
2. Copy content of LocalSettings.example.php to the end of LocalSettings.php (without "<?" on first line);
   - Set **$wgDocs2WikiApiUrl** to *Current web app URL* which got above (starts with https://script.google.com/macros/s/);
4. Run update script after install Extension:
   ```bash 
   $ docker-compose -f docker-compose.wiki.yaml exec mediawiki php /var/www/html/maintenance/update.php
   ```
### 3. Publish and Install Addon (Publish in Chrome Webstore)
1. Create project "Docs2Wiki Addon" on [GSuite Developer Hub](https://script.google.com/home);
2. Copy files from GApps/addon to project (create files with same names as in repository and copy-paste content);
3. Replace variables:
   - Mediawiki site url (main.gs, line 24);
   - ConsumerKey of mediawiki OAuth extension (main.gs, line 39);
   - ConsumerSecret of mediawiki OAuth extension (main.gs, line 40).
4. Publish Addon to the Chrome Webstore. Follow [instructions](https://developers.google.com/gsuite/add-ons/how-tos/publish-addons).
   - **NOTE:** One time fee 5$ needed to confirm developer account;
   - **NOTE:** Select 'Unlisted' publishing option to use installation by link and don't wait while moderators aprove it;
5. Install published addon.

## Third party libraries (Included to repository)
* [OAuth1 for Apps Script](https://github.com/gsuitedevs/apps-script-oauth1);
* [Underscore.js](https://underscorejs.org/);
* [Mediawiki OAuth Extension](https://www.mediawiki.org/wiki/Extension:OAuth).
