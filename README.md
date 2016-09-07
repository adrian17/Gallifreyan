Gallifreyan
===========

##A Gallifreyan Alphabet translator

###About

You can view the site at: http://adrian17.github.io/Gallifreyan/
The project's purpose is to quickly create complex and customizable Gallifreyan words/sentences, without the need for image processing tools.

The project is based on Sherman's Circular Gallifreyan, for more information about the language visit http://www.shermansplanet.com/gallifreyan


###TODO:

####fixes:
- the logic that limits angles in order to preserve letter/word order bugs out in rare cases
- the same with the word circle drawing, it's even more important as the bug makes it impossible to make overlapping letters

####features:
- doubled vowels/consonants
- manual addition of lines
- manually detach/reattach merged circles
...
- support for punctuation, numbers?
- remember the state after changing the text if only some words were changed?

####enhancements:
- make line creation algorithm smarter
- disallow placing lines on invisible sections of circles (use some proper logic instead of pixel-checking workaround in createLines() )
- make arranging words prettier
- overall tweaks for the generation code, especially sizes