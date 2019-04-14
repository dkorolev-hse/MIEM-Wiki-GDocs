<?php

class D2WSpecialRedirect2Docs extends SpecialPage {
	function __construct() {
		parent::__construct( 'Docs2Wiki' );
	}

	/*
     * Returns Standalone app API URL defined in LocalSettings.php
     */
    private static function getApiUrl () {
        global $wgDocs2WikiApiUrl;
        return $wgDocs2WikiApiUrl;
    }

	function requestEditAccess($email, $doc_id) {
		
		$data = array( 
			'resource' => 'user', 
			'action' => 'add_document', 
			'email' => $email, 
			'docId' => $doc_id
		);
		
        $options = array(
            'http' => array(
                'header'  => "Content-type: application/json",
                'method'  => 'POST',
                'content' => json_encode($data)
            ),
        );
        $context = stream_context_create( $options );
		$result = file_get_contents( D2WSpecialRedirect2Docs::getApiUrl(), false, $context );
		
		return $result;
	}

	function execute( $par ) {
		$request = $this->getRequest();
		$output = $this->getOutput();
		$this->setHeaders();

		# Get request data from, e.g.
		$email = $request->getText( 'email' );
		$google_docs_id = $request->getText( 'doc_id' );

		$this->requestEditAccess($email, $google_docs_id);
		$output->addHTML( '<script>window.location = "https://docs.google.com/document/d/'.$google_docs_id.'/edit"</script>' );
	}
}