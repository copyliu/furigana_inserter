# Release Notes #
## Furigana Inserter 2.11 (22.1.2014) ##
  * make compatible with Fx 34
## Furigana Inserter 2.10 (03.07.2014) ##
  * minor improvements
## Furigana Inserter 2.9 (22.06.2014) ##
  * Fixed some bugs.
  * Removed features that I no longer use.
  * The new release requires Fx 29.

## Furigana Inserter 2.8 (01.04.2013) ##
  * Added: support for Fedora 18
  * Added: uses the session store to store tab options
  * Fixed: scrolling the popup window works again (the Fx API changed)
  * Fixed: uses the privacy context when copying text to the clipboard

## Furigana Inserter 2.4 (03.09.2012) ##
  * Fixed: [Issue 1](https://code.google.com/p/itadaki/issues/detail?id=1). FI didn't work on pages with frames.
  * Fixed: small bugs

## Furigana Inserter 2.1 (27.06.2012) ##
  * Changed: doesn't use Rikaichan anymore, Rikaichan's dictionaries are still required
  * Changed: latest MeCab for Windows v0.994 is included
  * Fixed: small bugs
  * Added: ability to zoom the popup window with ctrl+mouse wheel
  * Added: a tool bar for looking words up
  * Added: ability to lookup words by pressing a shortcut key
  * Added: ability to customize the shortcut key
  * Added: automatically adds a button to the tool bar
  * Added: clicking the tool bar button enables the popup

## Furigana Inserter 2.0.14 (06.03.2012) ##
  * Fixed: it wasn't always possible to compile a new user dictionary
  * Removed: some options and functions that I don't use

## Furigana Inserter 2.0.13 ##
  * Fixed: really made compatible with Fx 8.0

## Furigana Inserter 2.0.12 (19.10.2011) ##
  * Fixed: [issue 20](https://code.google.com/p/itadaki/issues/detail?id=20): Error about unknown OS on Linux

## Furigana Inserter 2.0.11 (27.09.2011) ##
  * Fixed: error message that appears when the dictionary can't be found
  * Changed: made compatible with Fx 8.0

## Furigana Inserter 2.0.10 (05.07.2011) ##
  * Fixed: clipboard monitoring inserted the text into the current tab

## Furigana Inserter 2.0.9 (28.05.2011) ##
  * Fixed: keywords didn't work after pressing "Cancel" in the keywords dialog
  * Added: a mode which allows to insert keywords instead of kanji
  * Changed: FI uses a worker now. Fx won't freeze any more. Because of some restrictions of the workers only UTF-8 dictionaries are supported on Mac OS X and Linux now.

## Furigana Inserter 2.0.8 (23.02.2011) ##
  * Fixed: [issue 14](https://code.google.com/p/itadaki/issues/detail?id=14)
  * Fixed: toolbar button appeared incorrectly in the toolbar customization dialog

## Furigana Inserter 2.0.7 (13.01.2011) ##
small improvements

## Furigana Inserter 2.0.6 (07.01.2011) ##
  * Fixed: several problems with substitution
  * Fixed: when a window is closed all clipboard monitors are unregistered now

## Furigana Inserter 2.0.5 (24.12.2010) ##
  * Fixed: user dictionary didn't work
  * Added: keywords mode
A fixed version of HTML Ruby is required. If you want to have space between ruby elements. It's available from the download page.

## Furigana Inserter 2.0.3 (25.10.2010) ##
  * Fixed: didn't work with Fx 4.0b6
  * Fixed: couldn't switch dictionary of popup with Enter/Shift

## Furigana Inserter 2.0.1 (16.08.2010) ##
  * Fixed: splitting into words didn't work correctly
  * Added: support for encodings other than UTF-8 for Linux and Mac OS X.

## Furigana Inserter 1.2.4 (04.08.2010) ##
  * Fixed: splitting into words didn't work correctly

## Furigana Inserter 2.0 (20.07.2010) ##
  * This version only works with Firefox 4 which is currently beta.
  * I added support for Linux and Mac OS X. Only tested on Windows XP and Linux.
  * The dictionary add-on didn't work on Linux. On Linux you have to install MeCab and a UTF-8 dictionary.
  * The user dictionary only works with the IPAdic dictionary.
  * On Windows the following dictionary encodings are supported now: UTF-8, SHIFT\_JIS and EUC-JP. UTF-16 isn't supported.

## Furigana Inserter 1.2.3 (20.07.2010) ##
  * Fixed: small bug

## Furigana Inserter 1.2.2 (19.07.2010) ##
  * Fixed: didn't work when user dictionary was missing

## Furigana Inserter 1.2.1 (18.07.2010) ##
  * Changed: separated substitutions and user dictionary
  * Fixed:  FI didn't correctly switch the dictionary when the user press Shift/Enter

## Furigana Inserter 1.2 (09.07.2010) ##
  * Added: filter for clipboard text
  * Added: ability to edit the user dictionary for MeCab

## Furigana Inserter 1.1.1 (01.05.2010) ##
  * Fixed: Now works with Rikaichan 2.0beta4

## Furigana Inserter 1.1.0 (29.04.2010) ##
  * Changed: [Rikaichan](http://www.polarcloud.com/rikaichan/) 2.0 is required for the popup menu to work
  * Changed: Translation popup now has a fixed size
  * Added: Support for installation of other MeCab dictionaries
  * Added: Pressing Shift/Enter will look up the word in the next Rikaichan dictionary
  * Fixed: Translation popup menu now works with [HTML Ruby](http://htmlruby.codeplex.com/) v6

## Furigana Inserter 1.0.14 (13.01.2010) ##
  * Fixed: Was monitoring the clipboard after the tab had been closed.
  * Added: Split text produced by AGTH for some games.

## Furigana Inserter 1.0.13 (23.12.2009) ##
  * Fixed: Popup didn't appear when user surfed to another web page.

## Furigana Inserter 1.0.12 (20.12.2009) ##
  * Fixed: English locale
  * Fixed: Sometimes Furigana wasn't inserted in a selection

## Furigana Inserter 1.0.11 (16.12.2009) ##
  * Improved popup placement

## Furigana Inserter 1.0.10 (02.12.2009) ##
  * Fixed: Sometimes the style of the popup wasn't changed, when the user selected a new style in the options of Rikaichan
  * Added: Russian and German locales, thanks to those who sent them

## Furigana Inserter 1.0.9 (28.11.2009) ##
  * Fixed: Sometimes a space was inserted into the web page

## Furigana Inserter 1.0.8 (24.11.2009) ##
  * Fixed: Sometimes furigana wasn't inserted in a selection.

## Furigana Inserter 1.0.7 (21.11.2009) ##
  * Fixed: Bug introduced in 1.0.6. Sometimes after showing the popup the page scrolled to the wrong place.
  * Fixed: When you selected text, that spanned two or more paragraphs, and inserted furigana into this selection, sometimes paragraphs were split in two.

## Furigana Inserter 1.0.6 (16.11.2009) ##
  * "Copy Text Without Furigana" only shows up if text is selected
  * Reworked the popup
  * Made compatible with Firefox 3.6
  * Fixed: furigana was inserted in the wrong tab, if "process every page automatically" was turned on and user reloaded a tab through right-click menu.
  * Added support for a user dictionary. The option "extensions.furiganainserter.user\_dic\_path" is only accessible through "about:options". This is a feature for advanced users.
  * Changed defaults: FI now uses words for lookup and splits Japanese into words per default
  * Removed option to not insert furigana for links from the options dialog. Still accessible through "about:config".
  * Improved the error message: now also shows the error from MeCab.

## Furigana Inserter 1.0.3 (18.08.2009) ##
This is a minor update.
  * Fixed: Selection was removed even in the "use word" mode.
  * Fixed: Word lookup didn't work in Firefox 3.5 with dynamically inserted ruby.

## Furigana Inserter 1.0.2 (15.07.2009) ##
This is a major update.
  * Added: You can now choose between hiragana, katakana and romaji for furigana alphabet.
  * Added: Furigana Inserter can now split Japanese into words. You can change the style of those words in `chrome\userContent.css` in your Firefox profile directory.
  * Furigana Inserter can now look up words and display the translation in a popup just like Rikaichan. [Rikaichan](https://addons.mozilla.org/firefox/addon/2471) needs to be installed for that to work. There are two lookup modes:
    1. If Furigana Inserter is configured to split words then a word can be used for lookup. Just move the mouse cursor somewhere into the word.
    1. Furigana Inserter can lookup the word that follows the cursor, just like Rikaichan. It will ignore all markup in the word, including ruby (furigana).

## Furigana Inserter 1.0.1 (31.05.2009) ##
  * Fixed: Sometimes, very rarely it didn't insert furigana for some words.
  * Fixed: Other small bugs.

## Furigana Inserter 1.0.0 (24.05.2009) ##
  * Fixed: Some bugs, that could not be triggered through the normal user interface.
  * Changed GUI: Now you have to use left click to access the menu in the status bar.

Works with Firefox 3.5.

## Furigana Inserter 0.9.4 (22.12.2008) ##
  * Major bug fix: Should now work on all versions of Windows. Not only on German and English versions. Only tested on German Windows XP.

Works with Firefox 3.1 beta 2.

## Furigana Inserter 0.9.3 (05.07.2008) ##
  * Fixed: Furigana wasn't displayed for words starting with hiragana.
  * Improved speed.
  * Rewritten more code for speed and clarity. Almost all code is rewritten by now.

## Furigana Inserter 0.9.2 (30.06.2008) ##
  * If the Rikaichan add-on is installed then it is modified to ignore ruby elements.
  * Removed on-the-fly modifications to the HTML Ruby add-on. The latest version of HTML Ruby - version 4.43 works great without any modifications.

## Furigana Inserter 0.9.1 (29.06.2008) ##
  * Second release. Requires Firefox 3. Also requires the HTML Ruby add-on to display furigana.

## Furigana Inserter 0.9 (24.06.2008) ##
  * This is the first release of Furigana Inserter. Currently it only works on Windows. Only tested on Windows XP SP3. You are welcome to port it to other platforms and to submit patches. I'll gladly accept them.