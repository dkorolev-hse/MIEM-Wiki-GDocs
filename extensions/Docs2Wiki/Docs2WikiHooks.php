<?php

namespace MediaWiki\Extensions\Docs2Wiki;

use \MediaWiki\MediaWikiServices;
use \MediaWiki\EditPage;

class Docs2WikiHooks
{
    /*
     * Returns Standalone app API URL defined in LocalSettings.php
     */
    private static function getApiUrl () {
        global $wgDocs2WikiApiUrl;
        return $wgDocs2WikiApiUrl;
    }

    static public function onBeforePageDisplay(&$out, &$skin) {}

    /*
     * Add link to Google Doc to the end of WikiPage
     */
    public static function onArticleViewFooter( $article ) {
        $dbr = wfGetDB( DB_REPLICA );
        $google_docs_id = $dbr->selectField('page', 'google_docs_id', array('page_id' => $article->getPage()->getId()));
        if (!is_null($google_docs_id)) {
            $googleDocLink = 'https://docs.google.com/document/d/'.$google_docs_id.'/edit';
            $article->getContext()->getOutput()->addHTML(
                '<br><hr><a href="' . $googleDocLink . '">Open in Google Doc</a>'
            );
        }
    }

    /*
     * Send wikipage content to Standalone App API for save it into Google Docs
     */
    public static function onPageContentSaveComplete( &$wikiPage, &$user, $content, $summary, $isMinor, $isWatch, $section, &$flags, $revision, &$status, $baseRevId, $undidRevId ) {

        $dbr = wfGetDB( DB_MASTER );
        $google_docs_id = $dbr->selectField('page', 'google_docs_id', array('page_id' => $wikiPage->getId()));
        $pageTitle = $wikiPage->getTitle()->mTextform;
        $pageContent = $content->getContentHandler()->serializeContent( $content );
        $pageContent = Docs2WikiHooks::html_to_obj($content->getParserOutput($wikiPage->getTitle())->getText());
        $data = array( 'resource' => 'page', 'pageTitle' => $pageTitle, 'pageContent' => $pageContent);
        if (is_null($google_docs_id)) {
            // TODO: make post request to create new Google Document
            $data['action'] = 'create';
        } else {
            // TODO: send wiki page content to google docs app script web handler
            $data['action'] = 'update';
            $data['fileId'] = $google_docs_id;
        }

        $options = array(
            'http' => array(
                'header'  => "Content-type: application/json",
                'method'  => 'POST',
                'content' => json_encode($data)
            ),
        );
        $context = stream_context_create( $options );
        $result = file_get_contents( Docs2WikiHooks::getApiUrl(), false, $context );
        if ($result) {
            $resultObj = json_decode($result, true);
            // TODO: add validation to fileId
            if ($resultObj['status'] === 'created' && $resultObj['fileId']) {
                if (is_string($resultObj['fileId']) && strlen($resultObj['fileId']) === 44) {
                    $dbr->update( 'page', array('google_docs_id' => $resultObj['fileId']), array('page_id' => $wikiPage->getId()) );
                }
            }
        }
    }

    /*
     * Converts HTML to Object representation
     */
    private static function html_to_obj($html) {

        function element_to_obj($element) {
            $obj = array( "tag" => $element->tagName );
            foreach ($element->attributes as $attribute) {
                $obj[$attribute->name] = $attribute->value;
            }

            if (count($element->childNodes) === 1 && $element->childNodes[0]->nodeType == XML_TEXT_NODE) {
                $obj["html"] = $element->childNodes[0]->wholeText;
            } else {
                foreach ($element->childNodes as $subElement) {
                    if ($subElement->nodeType == XML_TEXT_NODE) {
                        if ($subElement->wholeText === "\n\n") {
                            $obj["children"][] = array( "tag" => "br" );
                        } else if ($subElement->wholeText !== "\n") {
                            $text = $subElement->wholeText;
                            $obj["children"][] = array( "tag" => "span", "html" => rtrim($text, "\n\r"));
                        }
                    }
                    else {
                        $obj["children"][] = element_to_obj($subElement);
                    }
                }
            }
            return $obj;
        }

        $dom = new \DOMDocument();
        $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html);
        return element_to_obj($dom->documentElement);
    }

    public static function onAlternateEdit( $editpage ) {
        global $wgUser;
        
        if ($wgUser->getId() === 0) {
            $editpage->editFormPageTop = '<span style="color: red; opacity: 0.8;">Google docs: Please login to edit.</span><br><hr>';
            return true;
        }
        
        $avaliable_domains = ['gmail.com', 'miem.hse.ru'];
        $email = $wgUser->getEmail();
        $emailParts = explode('@', $email);

		if (!in_array($emailParts[count($emailParts) - 1], $avaliable_domains)) {
            $editpage->editFormPageTop = '<span style="color: red; opacity: 0.8;">Google docs: User\' email domain is not supported</span><br><hr>';
            return true;
        } 

        $dbr = wfGetDB( DB_REPLICA );
        $wikiPage = $editpage->mArticle->getPage();
        $google_docs_id = $dbr->selectField('page', 'google_docs_id', array('page_id' => $wikiPage->getId()));
        
        if (!is_null($google_docs_id) && !empty($google_docs_id)) {
            $googleDocLink = 'index.php/Special:Docs2Wiki?doc_id='.$google_docs_id.'&email='.$email;
            $editpage->editFormPageTop = '<a href="' . $googleDocLink . '">Edit in Google Doc</a><br><hr>';
        } else {
            $editpage->editFormPageTop = '<span style="color: red; opacity: 0.8;">Google docs: document is not created yet. Save page manually to create document on google drive.</span><br><hr>';
        }
    }

}