<?php

namespace MediaWiki\Extensions\Docs2Wiki\Database;

/**
 * Class containing updater function to add google_docs_id into page table
 */
class UpdaterHooks {
    /**
     * @param \DatabaseUpdater $updater
     * @return bool
     */
    public static function addSchemaUpdates( \DatabaseUpdater $updater ) {
        $base = __DIR__;
        $updater->addExtensionUpdate( [
            'addField',
            'page',
            'google_docs_id',
            "$base/migrations/Page.sql",
            true
        ] );
        return true;
    }
}
