<?php

use Illuminate\Support\Facades\Route;

Route::get('/croct/home-banner', static function (\Croct\Plug\Plug $croct) {
    return view('croct.home-banner', [
        'content' => $croct->fetchContent('home-banner')->getContent(),
    ]);
});
