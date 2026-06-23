<?php

Route::get('/', function () {
    return view('welcome', ['note' => 'it\'s a test']);
});
