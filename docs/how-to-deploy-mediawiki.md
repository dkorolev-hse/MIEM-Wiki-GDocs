# How to Install Mediawiki & Setup OAuth extension
## Required
* Docker
## MediaWiki and OAuth installation
1. Copy files to project's root directory (/path/to/wiki): 
* docker-compose.wiki.yaml
* Dockerfile
* extensions/OAuth
2. Run in terminal:
```sh
$ docker-compose -f docker-compose.wiki.yaml build
$ docker-compose -f docker-compose.wiki.yaml up -d
```
3. Open wiki in browser (http://localhost or http://example.com) and follow setup steps;
* Don't forget select OAuth on extensions installation step;
4. Download and put LocalSettings.php to project's root directory;
5. Uncomment LocalSettings.php volume in docker-compose.wiki.yaml (line 23);
6. To apply docker-compose file's change run in terminal:
```sh
$ docker-compose -f docker-compose.wiki.yaml up -d
```

## Setup OAuth Consumer
1. Fill and Submit form: http://your-host/index.php/Special:OAuthConsumerRegistration/propose
2. Save "consumer token" and "secret token" (will beused by Addon);
3. Activate OAuth Consumer, could be found in list (http://your-host/index.php//index.php/Special:OAuthListConsumers)
