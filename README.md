Gallifreyan
===========

##A Gallifreyan Alphabet translator

###About

You can view the site at: http://adrian17.github.io/Gallifreyan/
The project's purpose is to quickly create complex and customizable Gallifreyan words/sentences, without the need for image processing tools.

###About the language

The Circular Gallifreyan Alphabet is a fictional language inspired by the Doctor Who TV series. It was created by Loren Sherman.
You can find specific info about the alphabet here: http://www.shermansplanet.com/gallifreyan


TODO:

fixes:
- the part that limits angles in order to preserve letter/word order bugs out in rare cases
- the same with the word circle drawing, it's even more important as it makes it impossible to make overlapping letters

features:
- doubled vowels/consonants
- manual addition/deletion of lines
- manually detach/reattach merged circles
...
- support for punctuation, numbers?
- remember the state after changing the text if only some words were changed?

enhancements:
- make line creation algorithm smarter
- make arranging words prettier
- overall tweaks for the generation code, especially sizes