"use strict";
var canvasSize  = 1000.0;               //the image resolution in pixels
var canvasScale = canvasSize / 800.0;   //800=the canvas size on the screen
var midPoint    = canvasSize / 2.0;     //the (x, y) of the centerpoint
var outerR      = midPoint * 0.9;       //radius of the outermost circle
var lineWidth   = 3.0 * canvasScale;
var PI = Math.PI;

var allCircles      = [],
    wordCircles     = [],
    currentCircle   = null, //points to a wordCircle which contains selectedCircle
    selectedCircle  = null, //points to selected circle
    snapMode        = true; //disabling this disables some rule checking; can't be toggled for now

var lines           = [],
    selectedLine    = null, //points to selected line
    lineEnd         = 0;    //tells which end of the line is selected

var dirtyRender     = true; //whether GUI and red dots will be drawn

var deleteLineMode  = false;//whether next selected line will be deleted

Array.prototype.contains = function(k) {
    return (this.indexOf(k) != -1);
}

Array.prototype.remove = function(index) {
    this.splice(index, 1);
    return this;
};

Array.prototype.removeItem = function(item) {
    var index = this.indexOf(item);
    return index > -1 ? this.remove(index) : this;
};

//math
function dist(a, b, x, y) { return Math.sqrt(Math.pow((a - x), 2) + Math.pow((b - y), 2)) }
function normalizeAngle(angle) { while (angle > PI) angle -= 2 * PI; while (angle < -PI) angle += 2 * PI; return angle }    //caps to (-PI, PI)

//since we are drawing mostly circles, it's not like we need control over beginPath() and stroke() anyway
function drawCircle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.stroke(); }
function drawArc(x, y, r, a1, a2) { ctx.beginPath(); ctx.arc(x, y, r, a1, a2); ctx.stroke(); }
function drawLine(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function drawDot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.fill(); }

//draws a red dot in a given location, signifying a circle you can select
function drawRedDot(x, y) { ctx.fillStyle = "red"; drawDot(x, y, 3 + lineWidth / 3); ctx.fillStyle = "black"; }
function drawBigRedDot(x, y) { ctx.fillStyle = "red"; drawDot(x, y, 3 + lineWidth); ctx.fillStyle = "black"; }

$(document).ready(function() {
    $('input').val(localStorage.getItem("input"));

    prepareCanvas();

    createGUI();

    redraw();
});

//resets everything and parses the text
function updateText() {
    resetZoom();

    wordCircles = []; allCircles = []; lines = []; currentCircle = null; selectedCircle = null; selectedLine = null;

    var text = $('input').val().trim().toLowerCase().split(" ");
    localStorage.setItem("input", $('input').val());
    var words = [];
    for (var j = 0; j < text.length; j++) {
        var toParse = text[j];
        words.push([]);
        for (var i = 0; i < toParse.length; i++) {
            if (toParse.substring(i, i + 2).match("(ch|sh|th|ng|qu)")) {
                words[j].push(toParse.substring(i, i + 2));
                i++;
            } else if (toParse[i] === "c") {
                //soft c comes usually before i, e or y
                if (i+1 < toParse.length && toParse[i+1].match("[iey]"))
                    words[j].push("s");
                else
                    words[j].push("k");
            } else {
                words[j].push(toParse[i]);
            }
        }
    }
    generateWords(words);
}

//disconnect the line from both circles it's connected to, and remove it from the global list
function deleteLine(line) {
    line.points[0].circle.lines.removeItem(line);
    line.points[1].circle.lines.removeItem(line);
    lines.removeItem(line);
}

//a line is always defined be the circles it is connected to and angles in relation to these circles.
//thus, it will always be connected to the circles' borders.
function Line(circle1, a1, circle2, a2) {
    this.draw = function() {
        ctx.strokeStyle = (selectedLine === this) ? "grey" : "black";
        drawLine(this.points[0].x, this.points[0].y, this.points[1].x, this.points[1].y)
        if (dirtyRender && this.selectable) {
            if (deleteLineMode) {
                drawBigRedDot(this.points[0].x, this.points[0].y);
                drawBigRedDot(this.points[1].x, this.points[1].y);
            } else {
                drawRedDot(this.points[0].x, this.points[0].y);
                drawRedDot(this.points[1].x, this.points[1].y);
            }
        }
    }
    this.update = function() {
        for (var i = 0; i < 2; ++i) {
            var point = this.points[i];
            point.x = point.circle.x + point.circle.r * Math.cos(point.a);
            point.y = point.circle.y + point.circle.r * Math.sin(point.a);
        }
    }
    this.updatePoint = function(end, circle, a) {
        var point = this.points[end];
        point.circle.lines.removeItem(this);
        point.circle = circle; circle.lines.push(this);
        point.a = a;
        this.update();
    }
    this.points = [{ circle: circle1, a: a1 },
                 { circle: circle2, a: a2 }];
    this.selectable = true;

    circle1.lines.push(this); circle2.lines.push(this);
    this.update();
}

//every circle or arc you can see is of this class.
//every circle has:
//an owner - the location is always calculated in relation to its owner's position and angle
//a type - which corresponds to the row of the alphabet
//a subtype - which corresponds to the column of the alphabet
//if the letter is a vowel, then type=5 (when it's a standalone letter) or 6 (when it's connected to a consonant)
//a list of other circles and lines connected to it, so they can easily updated in a cascading style
function Circle(owner, type, subtype, d, r, a) {
    this.draw = function() {
        ctx.strokeStyle = (selectedCircle === this) ? "grey" : "black";

        if (wordCircles.contains(this)) {           //it's a wordCircle so we need to make a gap for B- and T- row letters
            var angles = [];                        //a list of intersections with these letters
            for (var i = 0; i < this.children.length; ++i) {
                var child = this.children[i];
                if (child.type === 3 || child.type === 1) {
                    var d, an;
                    d = dist(this.x, this.y, child.x, child.y);
                    an = Math.acos((child.r * child.r - d * d - this.r * this.r) / (-2 * d * this.r));
                    angles.push(child.a + an, child.a - an);
                }
            }
            if (angles.length === 0) angles = [0, 2 * PI];
            for (var i = angles.length; i > 0; i -= 2) {    //we're going in the oppposite direction as that's how arc() draws
                drawArc(this.x, this.y, this.r, angles[i % angles.length], angles[i - 1]);
            }
        }
        else if (this.type === 3 || this.type === 1) {      //so it's not a wordCircle; now let's check if it's a B- or T- row letter
            var d, an;
            d = dist(this.x, this.y, this.owner.x, this.owner.y);
            an = Math.acos((this.owner.r * this.owner.r - d * d - this.r * this.r) / (-2 * d * this.r)); an = (PI / 2 - an)
            drawArc(this.x, this.y, this.r, this.a + PI / 2 + an, this.a + 3 / 2 * PI - an);
        }
        else {                                      //if not, we can just draw a circle there
            drawCircle(this.x, this.y, this.r);
        }

        if (this.type < 5 && (this.subtype === 2 || this.subtype === 3)) {  //drawing the dots
            var dotR = 3 + lineWidth / 2, r = this.r - 1 - 3 * dotR, delta = (0.2 * this.owner.r / this.r);
            for (var i = -1; i < this.subtype - 1; i++)
                drawDot(this.x - Math.cos(this.a + delta * i) * r, this.y - Math.sin(this.a + delta * i) * r, dotR);
        }
        if (dirtyRender && this.selectable)
            drawRedDot(this.x, this.y);
    }

    this.update = function(d, a) {      //recalculates the position, forces other circles/lines connected to it to update too
        var dx, dy;
        var oldA = this.a;
        dx = Math.cos(a) * (d), dy = Math.sin(a) * (d);
        this.x = this.owner.x + dx; this.y = this.owner.y + dy; this.d = d;
        this.a = normalizeAngle(a);
        for (var i = 0; i < this.children.length; i++) {
            if (wordCircles.contains(this))
                this.children[i].update(this.children[i].d, this.children[i].a);
            else
                this.children[i].update(this.children[i].d, this.children[i].a - oldA + this.a);
        }
        for (var i = 0; i < this.lines.length; i++)
            this.lines[i].update();
    }
    this.owner = owner;
    this.children = [];
    this.type = type; this.subtype = subtype;
    this.nLines = 0;        //expected number of lines, according to rules
    this.lines = [];
    this.selectable = true;
    this.r = r;
    this.update(d, a);
}

//selects the circle/line. Checks whether any buttons are pressed.
function doClick(e) {
    var mouse = getMouse(e);
    if (selectedCircle != null) { selectedCircle = null; redraw(); return; }
    if (selectedLine != null) { selectedLine = null; redraw(); return; }

    for (var i = 0; i < buttons.length; ++i) {
        if (buttons[i].click(e)) return;
    }

    var i, j, k;
    var minD = 40;
    for (i = 0; i < allCircles.length; ++i) {
        if (!allCircles[i].selectable) continue;
        var d = dist(allCircles[i].x, allCircles[i].y, mouse.x, mouse.y);
        if (d < minD) {
            minD = d;
            selectedCircle = allCircles[i];
            if (selectedCircle.type === 6) currentCircle = selectedCircle.owner.owner;
            else currentCircle = selectedCircle.owner;
        }
    }
    for (i = 0; i < lines.length; ++i) {
        if (!lines[i].selectable) continue;
        for (j = 0; j < 2; ++j) {
            var d = dist(lines[i].points[j].x, lines[i].points[j].y, mouse.x, mouse.y);
            if (d < minD) {
                minD = d;
                selectedLine = lines[i];
                lineEnd = j;
            }
        }
    }
    if (selectedLine != null) {
        selectedCircle = null;    //if we've selected a line, let's unselect a circle
        if (deleteLineMode) {
            deleteLine(selectedLine);
            selectedLine = null;
        }
    }
    if (deleteLineMode) {
        deleteLineMode = false;
        redraw();
    }
};

//makes sure that the correct distance from the base circle is kept according to language rules
function correctCircleLocation(selected, d, a) {
    if (!snapMode) { selected.update(d, a); return; }
    switch (selected.type) {
        case 1:     //B-row
            if (d > selected.owner.r - selected.r * 0.5) d = selected.owner.r - selected.r * 0.5;
            if (d < selected.owner.r - selected.r + 1) d = selected.owner.r - selected.r + 1;
            break;
        case 2:     //J-row
            if (d > selected.owner.r - selected.r - 5) d = selected.owner.r - selected.r - 5;
            break;
        case 3:     //T-row
            if (d > selected.owner.r + selected.r * 0.8) d = selected.owner.r + selected.r * 0.8;
            if (d < selected.owner.r) d = selected.owner.r;
            break;
        case 4:     //TH-row
            d = selected.owner.r;
            break;
        case 5:     //vowels, laying on a wordCircle
            switch (selected.subtype) {
                case 1: if (d < selected.owner.r + selected.r) d = selected.owner.r + selected.r; break;
                case 2:
                case 3:
                case 5:
                    d = selected.owner.r; break;
                case 4: if (d > selected.owner.r - selected.r) d = selected.owner.r - selected.r; break;
            } break;
        case 6:     //vowels, connected to consonants
            switch (selected.subtype) {
                case 1:
                    if (selected.owner.type === 1) { if (d < selected.r * 2) d = selected.r * 2; a = selected.owner.a; }
                    if (selected.owner.type === 2) { if (d < selected.owner.r + selected.r) d = selected.owner.r + selected.r; a = selected.owner.a; }
                    if (selected.owner.type === 3) { if (d < selected.owner.r / 2) d = selected.owner.r / 2; a = selected.owner.a; }
                    if (selected.owner.type === 4) {
                        if (d < selected.r) d = selected.r;
                        if (d > selected.owner.r - selected.r) d = selected.owner.r - selected.r; a = selected.owner.a;
                    }
                    break;
                case 2:
                case 3:
                case 5:
                    if (selected.owner.type === 3) { d = selected.owner.d - selected.owner.owner.r; a = selected.owner.a + PI; }//locked
                    else d = 0;
                    break;
                case 4:
                    d = selected.owner.r; break;
            } break;
    }
    selected.update(d, a);
    for (var i = 0; i < selected.children.length; i++)
        correctCircleLocation(selected.children[i], selected.children[i].d, selected.children[i].a);
}

//manages the movement of circles and lines. In case of circles, correctCircleLocation() is called to enforce language rules
$('canvas').mousemove(function(e) {
    var mouse = getMouse(e);
    if (selectedCircle != null) {
        var selected = selectedCircle;
        var a = Math.atan2(mouse.y - selected.owner.y, mouse.x - selected.owner.x);
        a = normalizeAngle(a);
        var d = dist(mouse.x, mouse.y, selected.owner.x, selected.owner.y);
        if (selected.type != 6 && currentCircle.children.length > 2) {
            var index = currentCircle.children.indexOf(selectedCircle);
            var nextAngle = (index + 1 >= currentCircle.children.length ?
                    PI / 2 : //it's a last circle, so let's make sure it looks like the last one
                    currentCircle.children[index + 1].a),
                previousAngle = (index - 1 < 0 ?
                    PI / 2 :    //it's first circle, so let's make sure it looks like the first one
                    currentCircle.children[index - 1].a);
            if (nextAngle > previousAngle) { a > 0 ? previousAngle += 2 * PI : nextAngle -= 2 * PI; }   //still buggy
            if (a - nextAngle > 2 * PI || a - previousAngle > 2 * PI) a -= 2 * PI; if (a - nextAngle < -2 * PI || a - previousAngle < -2 * PI) a += 2 * PI;
            if (a < nextAngle) a = nextAngle; else if (a > previousAngle) a = previousAngle;
        }
        correctCircleLocation(selected, d, a);
        redraw();
        return;
    }
    var i, a;
    if (selectedLine != null) {
        var selected = selectedLine;
        var minD = 50;
        for (i = 0; i < allCircles.length; ++i) {
            var d = dist(mouse.x, mouse.y, allCircles[i].x, allCircles[i].y) - allCircles[i].r; d = Math.abs(d);
            if (d < minD) {
                minD = d;
                a = Math.atan2(mouse.y - allCircles[i].y, mouse.x - allCircles[i].x);
                selected.updatePoint(lineEnd, allCircles[i], a);
            }
        }
        redraw();
        return;
    }
});

//changes the circle's radius
$('canvas').mousewheel(function(event, delta, deltaX, deltaY) {
    if (selectedCircle != null) {

        var selected = selectedCircle;
        var oldR = selected.r;
        if (delta > 0 || deltaX > 0 || deltaY > 0) selected.r += 2; else selected.r -= 2;

        if (selected.type >= 5)
            selected.r = selected.r < 10 ? 10 : selected.r;
        else
            selected.r = selected.r < selected.owner.r * 0.1 ? selected.owner.r * 0.1 : selected.r;

        for (var i = 0; i < selected.children.length; i++) {
            selected.children[i].r *= (selected.r / oldR);
            selected.children[i].update(selected.children[i].d * (selected.r / oldR), selected.children[i].a);
        }
        correctCircleLocation(selected, selected.d, selected.a);
        redraw();
    }
    return false;
});

//draws red lines to signify the min/max angles that the circle can move within
function drawAngles() {
    if (currentCircle.children.length < 3) return;
    var len = selectedCircle.owner.r * 1.3;
    var index = currentCircle.children.indexOf(selectedCircle);
    var nextAngle = (index + 1 >= currentCircle.children.length ?
        PI / 2 : //it's a last circle, so let's make sure it looks like the last one
        currentCircle.children[index + 1].a),
    previousAngle = (index - 1 < 0 ?
        PI / 2 :    //it's first circle, so let's make sure it looks like the first one
        currentCircle.children[index - 1].a);
    ctx.strokeStyle = "red";
    drawLine(currentCircle.x, currentCircle.y,
             currentCircle.x + Math.cos(nextAngle) * (len), currentCircle.y + Math.sin(nextAngle) * (len));
    drawLine(currentCircle.x, currentCircle.y,
             currentCircle.x + Math.cos(previousAngle) * (len), currentCircle.y + Math.sin(previousAngle) * (len));
    ctx.strokeStyle = "black";
}

//generates the sentence
function generateWords(words) {
    allCircles.push(new Circle({ x: midPoint, y: midPoint, a: 0 }, 4, 0, 0, outerR, 0));
    allCircles[0].selectable = false;

    var delta = 2 * PI / words.length;
    var angle = PI / 2;
    var r = words.length === 1 ? outerR * 0.8 : 1.7 * outerR / (words.length + 2);
    var d = words.length === 1 ? 0 : outerR - r * 1.2;

    for (var i = 0; i < words.length; i++) {
        if (i > 0) angle -= delta; angle = normalizeAngle(angle);

        var word = words[i];
        var wordL = 0;  //approximates the number of letters, taking into account that some will be merged
        for (var j = 0; j < word.length; j++) {
            if (j > 0 && word[j].match("^(a|e|i|o|u)$") && !(word[j - 1].match("^(a|e|i|o|u)$"))) continue;
            wordL++;
        }
        generateWord(word, wordL, r, d, angle)
    }
    redraw();

    createLines();

    redraw();
}

//assigns the subtype
var map = {
    "b": 1, "ch": 2, "d": 3, "f": 4, "g": 5, "h": 6,
    "j": 1, "k": 2, "l": 3, "m": 4, "n": 5, "p": 6,
    "t": 1, "sh": 2, "r": 3, "s": 4, "v": 5, "w": 6,
    "th": 1, "y": 2, "z": 3, "ng": 4, "qu": 5, "x": 6,
    "a": 1, "e": 2, "i": 3, "o": 4, "u": 5
};

//generates a single word
function generateWord(word, wordL, mcR, dist, mainAngle) {
    var delta = 2 * PI / wordL;
    var angle = PI / 2;
    var globalR = 1.8 * mcR / (wordL + 2);

    var i;
    var owner, newCircle = 0;

    var newMainCircle = new Circle(allCircles[0], 2, 0, dist, mcR, mainAngle);

    wordCircles.push(newMainCircle);
    allCircles.push(newMainCircle);
    allCircles[0].children.push(newMainCircle);

    for (var i = 0; i < word.length; i++) {
        var letter = word[i];
        newCircle = 0;
        owner = newMainCircle;

        if (i > 0) angle -= delta; angle = normalizeAngle(angle);

        var type = 0, r = 0, d = 0;
        var subtype = map[letter];
        var nLines = [0, 0, 0, 3, 1, 2][subtype - 1];
        if (letter.match("^(b|ch|d|f|g|h)$")) {
            type = 1, r = globalR, d = mcR - r + 1;
            newCircle = new Circle(owner, type, subtype, d, r, angle);
        }
        else if (letter.match("^(j|k|l|m|n|p)$")) {
            type = 2, r = globalR, d = mcR - r - 5;
            newCircle = new Circle(owner, type, subtype, d, r, angle);
        }
        else if (letter.match("^(t|sh|r|s|v|w)$")) {
            type = 3, r = globalR * 1.3, d = mcR * 1.1;
            newCircle = new Circle(owner, type, subtype, d, r, angle);
        }
        else if (letter.match("^(th|y|z|ng|qu|x)$")) {
            type = 4, r = globalR, d = mcR;
            newCircle = new Circle(owner, type, subtype, d, r, angle);
        }
        else if (letter.match("^(a|e|i|o|u)$")) {
            nLines = [0, 0, 1, 0, 1][subtype - 1];
            var previous = owner.children[owner.children.length - 1];
            r = globalR * 0.25;

            if (previous && subtype != 4 && previous.type === 3) {  //let's not attach to this as floating letters look ugly
                type = 5, d = mcR;
                angle += delta / 2;
                newCircle = new Circle(owner, type, subtype, owner.r, r, angle);
                angle += delta / 2;
            }
            else if (previous && i != 0 && previous.type < 5 && previous.children.length === 0) {   //are we free to attach?
                type = 6;
                owner = previous;
                angle += delta;
                newCircle = new Circle(owner, type, subtype, owner.r / 2, r, owner.a + PI + PI / 8);
                if ([2, 3, 5].contains(subtype)) newCircle.selectable = false;
            }
            else {  //let's just add this normally then.
                type = 5, d = mcR;
                newCircle = new Circle(owner, type, subtype, owner.r, r, angle);
            }
        }
        if (newCircle === 0) continue;  //skip, if the letter wasn't found

        newCircle.nLines = nLines;
        correctCircleLocation(newCircle, newCircle.d, newCircle.a);
        owner.children.push(newCircle);

        allCircles.push(newCircle);
    }
}

//checks if a line end is too close to an another line
//will bug out around the PI=-PI point but let's ignore it for now
function isLineTooClose(circle, angle) {
    for (var i = 0; i < circle.lines.length; ++i) {
        var diff, line = circle.lines[i];
        diff = normalizeAngle(line.points[0].a - angle); diff = Math.abs(diff);
        if (line.points[0].circle === circle && diff < 0.5) return 1;
        diff = normalizeAngle(line.points[1].a - angle); diff = Math.abs(diff);
        if (line.points[1].circle === circle && diff < 0.5) return 1;
    }
    return 0;
}

//generates the lines after all the circles are created
function createLines() {
    var i, j, k, circle, circle2, intersection, angle;
    var bestAngle = 0, inter, minInter;
    for (i = 1; i < allCircles.length; ++i) {
        circle = allCircles[i];
        if (circle.nLines === 0) continue;
        var passes = 0;
        while (circle.lines.length < circle.nLines) {
            //looks for the best path to the base circle if there are no other options left
            if (passes > 100 || (circle.type >= 5 && circle.subtype === 5)) {
                if (circle.type === 6) { if (circle.subtype === 3) var angle = circle.owner.a + PI; else angle = circle.owner.a; }
                else if (circle.type === 5 && circle.subtype === 5) angle = circle.a;
                else angle = circle.a + PI;

                circle2 = allCircles[0];    //the only one left

                //let's look for the path with the least intersections
                minInter = 1000;
                for (var n = 0; n < 100; ++n) {
                    inter = 0;
                    var randAngle = angle + (Math.random() - 0.5) * (circle.type === 6 ? PI / 6 : PI / 2);
                    var x = circle.x + circle.r * Math.cos(randAngle), y = circle.y + circle.r * Math.sin(randAngle);
                    intersection = findIntersection(circle2.x, circle2.y, circle2.r, x, y, randAngle);
                    var maxT = intersection.t;

                    if (isLineTooClose(circle, randAngle)) continue;
                    if (isLineTooClose(circle2, intersection.a)) continue;

                    for (k = 1; k < allCircles.length; ++k) {
                        if (k === i) continue;
                        var circle3 = allCircles[k];
                        intersection = findIntersection(circle3.x, circle3.y, circle3.r, x, y, randAngle);
                        if (intersection === 0) continue;
                        if (intersection.t < maxT) inter++;
                    }
                    if (inter < minInter) { minInter = inter; bestAngle = randAngle; }
                }
                var x = circle.x + circle.r * Math.cos(bestAngle), y = circle.y + circle.r * Math.sin(bestAngle);
                intersection = findIntersection(circle2.x, circle2.y, circle2.r, x, y, bestAngle);
                lines.push(new Line(circle, bestAngle, circle2, intersection.a));
                if (circle.type >= 5) break;
                else continue;
            }
            //normal routine, searches for pairs that still need circles
            for (j = 1; j < allCircles.length; ++j) {
                if (j === i) continue;
                circle2 = allCircles[j];
                if (circle2.lines.length >= circle2.nLines) continue;
                if (circle2.type >= 5 && circle2.subtype === 5) continue;
                angle = Math.atan2(circle2.y - circle.y, circle2.x - circle.x);
                var x = circle.x + circle.r * Math.cos(angle), y = circle.y + circle.r * Math.sin(angle);

                intersection = findIntersection(circle2.x, circle2.y, circle2.r, x, y, angle);
                if (intersection === 0) continue;
                if (Math.floor(Math.random() + 0.6)) continue;  //some extra randomness

                var rand = (Math.random() - 0.5) * PI / 4;

                if (isLineTooClose(circle, angle + rand)) continue;
                if (isLineTooClose(circle2, intersection.a - rand)) continue;

                //let's just check if we don't run into a white section of a circle
                if (circle.type === 1 || circle.type === 3) {
                    var x = circle.x + circle.r * Math.cos(angle + rand), y = circle.y + circle.r * Math.sin(angle + rand);
                    var data = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
                    if (!(data[0] != 255 && data[1] != 255 && data[2] != 255 && data[3] > 0)) continue;
                }
                if (circle2.type === 1 || circle2.type === 3) {
                    x = circle2.x + circle2.r * Math.cos(intersection.a - rand), y = circle2.y + circle2.r * Math.sin(intersection.a - rand);
                    data = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
                    if (!(data[0] != 255 && data[1] != 255 && data[2] != 255 && data[3] > 0)) continue;
                }
                //nothing more to check, let's make a line there
                lines.push(new Line(circle, angle + rand, circle2, intersection.a - rand));

                if (circle.lines.length >= circle.nLines) break;
            }
            passes++;
            if (passes > 103) break;
        }
    }
}

//checks whether all the circles have a correct amount of lines connected
function checkLines() {
    for (var i = 1; i < allCircles.length; ++i) {   //we don't check the first circle
        if (wordCircles.indexOf(allCircles[i]) != -1) continue; //also skip wordCircles
        if (allCircles[i].nLines != allCircles[i].lines.length) return 0;
    }
    return 1;
}

//the core drawing routine
function redraw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    var data = scrollerObj.getValues();
    ctx.setTransform(data.zoom, 0, 0, data.zoom, -data.left * canvasScale, -data.top * canvasScale);

    ctx.lineWidth = lineWidth;
    for (var i = 1; i < allCircles.length; ++i) {
        allCircles[i].draw();
    }
    if (allCircles.length > 0) allCircles[0].draw();

    for (var i = 0; i < lines.length; ++i) {
        lines[i].draw();
    }
    if (selectedCircle != null && selectedCircle.type != 6) drawAngles();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dirtyRender) { drawGUI(); }
}