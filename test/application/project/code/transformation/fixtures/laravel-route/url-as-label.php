<?php

use Illuminate\Support\Facades\Route;

$label = '/croct/home-banner';

Route::get('/dashboard', fn () => view('dashboard', ['label' => $label]));
