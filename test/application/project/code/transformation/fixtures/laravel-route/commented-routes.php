<?php

use Illuminate\Support\Facades\Route;

// Route::get('/croct/home-banner', fn () => 'commented with slashes');
# Route::get('/croct/home-banner', fn () => 'commented with hash');
/* Route::get('/croct/home-banner', fn () => 'commented in a block'); */

Route::get('/', fn () => view('welcome'));
