<?php
// copied from https://github.com/rjbultitude/darkskyjs

$api_key = '0123456789abcdef0123456789abcdef';

$API_ENDPOINT = 'https://api.darksky.net/forecast/';
$url = $API_ENDPOINT . $api_key . '/';

if(!isset($_GET['url'])) die();
$url = $url . $_GET['url'];
$url = file_get_contents($url);

print_r($url);