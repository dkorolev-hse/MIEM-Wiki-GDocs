<?
# End of automatically generated settings.
# Add this configuration option to the end of your LocalSettings.php file
wfLoadExtension( 'OAuth' );

$wgShowExceptionDetails = true;
$wgShowDBErrorBacktrace = true;
$wgShowSQLErrors = true;

$wgSMTP = [
 'host' => 'ssl://smtp.gmail.com',
 'IDHost' => 'gmail.com',
 'localhost' => 'localhost',
 'port' => 465,
 'username' => '', // REPLACE TO EMAIL
 'password' => '', // REPLACE TO SERVICE PASSWORD',
 'auth' => true
];

$wgGroupPermissions['sysop']['mwoauthproposeconsumer'] = true;
$wgGroupPermissions['sysop']['mwoauthupdateownconsumer'] = true;
$wgGroupPermissions['sysop']['mwoauthmanageconsumer'] = true;
$wgGroupPermissions['sysop']['mwoauthsuppress'] = true;
$wgGroupPermissions['sysop']['mwoauthviewsuppressed'] = true;
$wgGroupPermissions['sysop']['mwoauthviewprivate'] = true;
$wgGroupPermissions['sysop']['mwoauthmanagemygrants'] = true;

$wgAllowCopyUploads  = true;

wfLoadExtension( 'Docs2Wiki' );
$wgDocs2WikiApiUrl = ''; //GOOGLE DOCS MACROS API URL
