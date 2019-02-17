<?

/*
 * API endpoint for fetching page info by Google Docs Id
 * If page found returns { "status": "found", "item": { "title": "page name string" } }
 * otherwise returns { "status": "not_found", "item": null }
 */
class ApiGetByGoogleDocId extends ApiBase {

    public function execute() {
        $params = $this->extractRequestParams();
        $dbr = wfGetDB( DB_REPLICA );
        $row = $dbr->selectRow('page', array('page_id', 'page_title'), array('google_docs_id' => (string)$params['google_docs_id']));
        if ($row->page_id) {
            $result = array(
                'status' => 'found',
                'item' => array(
                    'title' => $row->page_title
                ),
            );
        } else {
            $result = array(
                'status' => 'not_found',
                'item' => NULL
            );
        }
        $this->getResult()->addValue( null, $this->getModuleName(), $result);
    }

    public function getAllowedParams() {
        return array(
            'google_docs_id' => array (
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => true
            ),
        );
    }
}