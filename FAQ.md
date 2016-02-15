# Frequently Asked Questions #

## How do I install a dictionary for Furigana Inserter? ##
There are two ways to install a dictionary required by Furigana Inserter.
  1. The first option is to install the dictionary add-on for Firefox.
    1. Download the file `furiganainserter-dictionary-<version>.7z` and unpack it with [7-Zip](http://www.7-zip.org) or WinRAR.
    1. Then either drag and drop the unpacked file `furiganainserter-dictionary.xpi` into a Firefox window or go the `File` menu in Firefox, choose `Open File...` and select the file `furiganainserter-dictionary.xpi`.
  1. Second option is to install [MeCab](http://code.google.com/p/mecab/downloads/list) instead of the dictionary add-on.
    1. If you are on Windows then download `mecab-<version>.exe` where `<version>` is the version number.
    1. During the installation choose the UTF-8 format.

## How do I change the font size of ruby (furigana)? ##
Firefox >= 38 has built-in support for ruby. Add the following code to `userContent.css`:
```
rt {
  font-size: 100%;
}
```

See [this](http://superuser.com/questions/318912/how-to-override-the-css-of-a-site-in-firefox-with-usercontent-css) for more information.

## Linux and Mac OS X ##
You need to install MeCab with the UTF-8 dictionary or MeCab and the dictionary add-on.

### Fedora ###
To install FI 2.7 on Fedora 18 64-bit:
  1. Drag and drop `furigana-inserter-<version>.xpi` file into Firefox.
  1. `sudo yum install mecab mecab-ipadic`
  1. `sudo ln -s /usr/lib64/libmecab.so.2 /usr/lib64/libmecab.so.1`

### Mac OS X ###

[Blog entry](http://akitaonrails.com/2012/05/08/off-topic-reading-with-subtitles-over-kanjis-in-japanese-webpages) explains how to install Furigana Inserter on Mac OS X.

### Ubuntu ###
prereqs

> firefox 38

install mecab

> open terminal (command line)
```
sudo apt-get install mecab
```
install plugin

https://addons.mozilla.org/en-us/firefox/addon/furigana-inserter/

download dictionary

https://code.google.com/p/itadaki/downloads/detail?name=furiganainserter-dictionary-1.2.7z

install dictionary

> drag the downloaded file into the firefox window