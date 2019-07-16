"use strict";
const canvasSize  = 1000.0;               //the image resolution in pixels
const canvasScale = canvasSize / 800.0;   //800=the canvas size on the screen
const midPoint    = canvasSize / 2.0;     //the (x, y) of the centerpoint
const outerR      = midPoint * 0.9;       //radius of the outermost circle
const PI = Math.PI;
var lineWidth   = 3.0 * canvasScale;

var allCircles      = [],
    currentCircle   = null, //points to a wordCircle which contains selectedCircle
    selectedCircle  = null, //points to selected circle
    snapMode        = true; //disabling this disables some rule checking; can't be toggled for now

var lines           = [],
    selectedLine    = null, //points to selected line
    lineEnd         = 0;    //tells which end of the line is selected

var dirtyRender     = true; //whether GUI and red dots will be drawn

var deleteLineMode  = false;//whether next selected line will be deleted

// Both ends of a line move with a cursor. It looks like you're placing the first end of the line.
// A click will disable this mode, and you'll normally control the other end of the line.
var addLineMode     = false;

Array.prototype.remove = function(index) {
    this.splice(index, 1);
    return this;
};

Array.prototype.removeItem = function(item) {
    var index = this.indexOf(item);
    return index > -1 ? this.remove(index) : this;
};

Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
};

function pointFromAngle(obj, r, angle) {
    return [obj.x + Math.cos(angle) * r, obj.y + Math.sin(angle) * r]
}

//math
function dist(a, b) { return Math.sqrt(Math.pow((a.x - b.x), 2) + Math.pow((a.y - b.y), 2)); }
function normalizeAngle(angle) { while (angle > PI) angle -= 2 * PI; while (angle < -PI) angle += 2 * PI; return angle; }    //caps to (-PI, PI)
function angleDifference(a, b) { return normalizeAngle(a-b); } // capped to (-PI, PI);

function isBetween(a1, a2, a) {
    a1 = normalizeAngle(a1);
    a2 = normalizeAngle(a2);
    a = normalizeAngle(a);
    if (a2 < a1) a2 += 2*PI;
    if (a < a1) a += 2*PI;
    return a < a2;
}

function angleBetweenCircles(circle, second) {
    var d = dist(circle, second);
    var angle = Math.acos((second.r*second.r - d*d - circle.r*circle.r) / (-2*d*circle.r));
    return angle;
}

//since we are drawing mostly circles, it's not like we need control over beginPath() and stroke() anyway
function drawCircle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.stroke(); }
function drawArc(x, y, r, a1, a2) { ctx.beginPath(); ctx.arc(x, y, r, a1, a2); ctx.stroke(); }
function drawBezier(x1, y1, x2, y2, ax1, ay1, ax2, ay2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(ax1, ay1, ax2, ay2, x2, y2); ctx.stroke(); }
function drawLine(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function drawDot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.fill(); }

//draws a red dot in a given location, signifying a circle you can select
function drawRedDot(x, y) { ctx.fillStyle = "red"; drawDot(x, y, 3 + lineWidth / 3); ctx.fillStyle = "black"; }
function drawSmallRedDot(x, y) { ctx.fillStyle = "red"; drawDot(x, y, 1 + lineWidth / 3); ctx.fillStyle = "black"; }
function drawBigRedDot(x, y) { ctx.fillStyle = "red"; drawDot(x, y, 4 + lineWidth / 2); ctx.fillStyle = "black"; }

$(document).ready(function() {
    $("input").val(localStorage.getItem("input"));

    prepareCanvas();

    createGUI();

    redraw();
});

//resets everything and parses the text
function updateText() {
    resetZoom();

    allCircles = []; lines = []; currentCircle = null; selectedCircle = null; selectedLine = null;

    var text = $("input").val().trim().toLowerCase().split(" ");
    localStorage.setItem("input", $("input").val());
    var words = [];
    for (var toParse of text) {
        var word = [];
        for (var i = 0; i < toParse.length; i++) {
            if (toParse.substring(i, i + 2).match("(ch|sh|th|ng|qu)")) {
                word.push(toParse.substring(i, i + 2));
                i++;
            } else if (toParse[i] === "c") {
                //soft c comes usually before i, e or y
                if (i+1 < toParse.length && toParse[i+1].match("[iey]"))
                    word.push("s");
                else
                    word.push("k");
            } else {
                word.push(toParse[i]);
            }
        }
        words.push(word);
    }
    generateWords(words);
}

//discard any unfinished manual actions (line addition/deletion)
function resetModes() {
    deleteLineMode  = false;
    if (addLineMode) {
        addLineMode = false;
        deleteLine(selectedLine);
        selectedLine = null;
    }
}

//create a new line and let user to position it
function addNewLine() {
    addLineMode = true;
    selectedLine = new Line(allCircles[0], -PI/2, allCircles[0], -PI/2);
    lines.push(selectedLine);
}

//disconnect the line from both circles it's connected to, and remove it from the global list
function deleteLine(line) {
    line.points[0].circle.lines.removeItem(line);
    line.points[1].circle.lines.removeItem(line);
    lines.removeItem(line);
}

//a line is always defined be the circles it is connected to and angles in relation to these circles.
//thus, it will always be connected to the circles' borders.
class Line {
    constructor(circle1, a1, circle2, a2) {
        this.points = [{ circle: circle1, a: a1 },
                     { circle: circle2, a: a2 }];

        this.rel_anchors = null;
        this.selectable = true;

        circle1.lines.push(this); circle2.lines.push(this);
        this.update();
    }
    get anchors() {
        if (!this.rel_anchors)
            return null;
        return [
            {x: this.points[0].x+this.rel_anchors[0].x, y: this.points[0].y+this.rel_anchors[0].y},
            {x: this.points[1].x+this.rel_anchors[1].x, y: this.points[1].y+this.rel_anchors[1].y},
        ]
    }
    draw() {
        ctx.strokeStyle = (selectedLine === this) ? "grey" : "black";

        let points = this.points, anchors = this.anchors;
        if (anchors) {
            drawBezier(
                points[0].x, points[0].y, points[1].x, points[1].y,
                anchors[0].x, anchors[0].y, anchors[1].x, anchors[1].y,
            );
        } else {
            drawLine(points[0].x, points[0].y, points[1].x, points[1].y)
        }

        if (dirtyRender && this.selectable) {
            if (deleteLineMode || (addLineMode && selectedLine === this)) {
                drawBigRedDot(points[0].x, points[0].y);
                drawBigRedDot(points[1].x, points[1].y);
            } else {
                if (anchors) {
                    ctx.strokeStyle = "gray"; ctx.lineWidth = 1;
                    drawLine(points[0].x, points[0].y, anchors[0].x, anchors[0].y);
                    drawLine(points[1].x, points[1].y, anchors[1].x, anchors[1].y)
                    ctx.strokeStyle = "black"; ctx.lineWidth = lineWidth;
                    drawSmallRedDot(anchors[0].x, anchors[0].y);
                    drawSmallRedDot(anchors[1].x, anchors[1].y);
                }

                drawRedDot(points[0].x, points[0].y);
                drawRedDot(points[1].x, points[1].y);
            }
        }
    }
    update() {
        for (var point of this.points)
            [point.x, point.y] = pointFromAngle(point.circle, point.circle.r, point.a);
    }
    updatePoint(end, circle, a) {
        var point = this.points[end];
        point.circle.lines.removeItem(this);
        point.circle = circle; circle.lines.push(this);
        point.a = a;
        this.update();
    }
}

//every circle or arc you can see is of this class.
//every circle has:
//an owner - the location is always calculated in relation to its owner's position and angle
//a type - which corresponds to the row of the alphabet
//a subtype - which corresponds to the column of the alphabet
//if the letter is a vowel, then type=5 (when it's a standalone letter) or 6 (when it's connected to a consonant)
//a list of other circles and lines connected to it, so they can easily updated in a cascading style
class Circle {
    constructor(owner, type, subtype, d, r, a) {
        this.owner = owner;
        this.children = [];
        this.type = type; this.subtype = subtype;

        // currently only word circles lay on main circle; this may change in the future
        this.isWordCircle = owner == allCircles[0];
        this.isVowel = this.type === 5 || this.type === 6;
        this.isConsonant = ! this.isVowel;
        this.hasGaps = this.type === 1 || this.type === 3;

        this.dots = this.isConsonant ? [null, 0, 2, 3, 0, 0, 0][this.subtype] : 0;

        this.nLines = 0;        //expected number of lines, according to rules
        this.lines = [];
        this.selectable = true;
        this.r = r;
        this.update(d, a);
    }
    draw() {
        ctx.strokeStyle = (selectedCircle === this) ? "grey" : "black";

        if (this.isWordCircle) {           //it's a wordCircle so we need to make a gap for B- and T- row letters
            var angles = [];                        //a list of intersections with these letters
            for (var child of this.children) {
                if (child.hasGaps) {
                    var an = angleBetweenCircles(this, child);
                    angles.push(child.a + an, child.a - an);
                }
            }
            if (angles.length === 0) angles = [0, 2 * PI];
            for (var i = angles.length; i > 0; i -= 2) {    //we're going in the oppposite direction as that's how arc() draws
                drawArc(this.x, this.y, this.r, angles[i % angles.length], angles[i - 1]);
            }
        }
        else if (this.hasGaps) {      //so it's not a wordCircle; now let's check if it's a B- or T- row letter
            var an = angleBetweenCircles(this, this.owner);
            drawArc(this.x, this.y, this.r, this.a + PI - an, this.a + PI + an);
        }
        else {                                      //if not, we can just draw a circle there
            drawCircle(this.x, this.y, this.r);
        }

        if (this.dots) {  //drawing the dots
            var dotR = 3 + lineWidth / 2;
            var r = this.r - 1 - 3 * dotR
            var delta = (0.2 * this.owner.r / this.r);
            for (var i = -1; i < this.dots - 1; i++)
                drawDot(...pointFromAngle(this, r, this.a + delta * i + PI), dotR);
        }
        if (dirtyRender && this.selectable)
            drawRedDot(this.x, this.y);
    }
    update(d, a) {      //recalculates the position, forces other circles/lines connected to it to update too
        var oldA = this.a;
        [this.x, this.y] = pointFromAngle(this.owner, d, a);
        this.d = d;
        this.a = normalizeAngle(a);
        for (var child of this.children) {
            if (this.isWordCircle)
                child.update(child.d, child.a); // don't change word orientation
            else
                child.update(child.d, child.a - oldA + this.a); // adjust vowel's orienatation
        }
        for (var line of this.lines)
            line.update();
    }
    hasPoint(a) {
        // check if point at this angle would be on a visible arc.
        // same basic logic as in draw()
        if (this.isWordCircle) {
            for (var child of this.children) {
                if (child.hasGaps) {
                    var an = angleBetweenCircles(this, child);
                    if (!isBetween(child.a + an, child.a - an, a))
                        return false;
                }
            }
            return true;
        }
        else if (this.hasGaps) {
            var an = angleBetweenCircles(this, this.owner);
            return isBetween(this.a + PI - an, this.a + PI + an, a);
        } else return true;
    }
}

//selects the circle/line. Checks whether any buttons are pressed.
function doClick(e) {
    var mouse = getMouse(e);
    if (selectedCircle != null) { selectedCircle = null; redraw(); return; }
    if (selectedLine != null && !addLineMode) { selectedLine = null; lineEnd = 0; redraw(); return; }

    for (var button of buttons) {
        if (button.click(e)) return;
    }

    var minD = 40;
    for (var circle of allCircles) {
        if (!circle.selectable) continue;
        var d = dist(circle, mouse);
        if (d < minD) {
            minD = d;
            selectedCircle = circle;
            if (selectedCircle.type === 6) currentCircle = selectedCircle.owner.owner;
            else currentCircle = selectedCircle.owner;
        }
    }
    for (var line of lines) {
        if (!line.selectable) continue;
        for (var j = 0; j < 2; ++j) {
            var d = dist(line.points[j], mouse);
            if (d < minD) {
                minD = d;
                selectedLine = line;
                lineEnd = j;
            }
        }
        if (line.anchors) {
            for (var j = 0; j < 2; ++j) {
                var d = dist(line.anchors[j], mouse);
                if (d < minD) {
                    minD = d;
                    selectedLine = line;
                    lineEnd = j+2;
                }
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
    if (addLineMode)
        addLineMode = false;	//don't move both ends anymore; now it's a normal selectedLine with one attached end
}

//makes sure that the correct distance from the base circle is kept according to language rules
function correctCircleLocation(selected, d, a) {
    if (!snapMode) { selected.update(d, a); return; }
    switch (selected.type) {
    case 1:     //B-row
        d = d.clamp(selected.owner.r - selected.r + 1, selected.owner.r - selected.r * 0.5);
        break;
    case 2:     //J-row
        d = d.clamp(0, selected.owner.r - selected.r - 5);
        break;
    case 3:     //T-row
        d = d.clamp(selected.owner.r, selected.owner.r + selected.r * 0.8);
        break;
    case 4:     //TH-row
        d = selected.owner.r;
        break;
    case 5:     //vowels, laying on a wordCircle
        switch (selected.subtype) {
        case 1: d = d.clamp(selected.owner.r + selected.r + 5, Infinity); break;
        case 2:
        case 3:
        case 5:
            d = selected.owner.r; break;
        case 4: d = d.clamp(0, selected.owner.r - selected.r - 5); break;
        } break;
    case 6:     //vowels, connected to consonants
        switch (selected.subtype) {
        case 1:
            if (selected.owner.type === 1) { d = d.clamp(selected.r * 2, Infinity); a = selected.owner.a; }
            if (selected.owner.type === 2) { d = d.clamp(selected.owner.r + selected.r, Infinity); a = selected.owner.a; }
            if (selected.owner.type === 3) { d = d.clamp(selected.owner.r / 2, Infinity); a = selected.owner.a; }
            if (selected.owner.type === 4) { d = d.clamp(selected.r, selected.owner.r - selected.r); a = selected.owner.a; }
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
    for (var child of selected.children)
        correctCircleLocation(child, child.d, child.a);
}

function getCircleAngleLimits(circle) {
    var index = currentCircle.children.indexOf(circle);
    // first/last letter of a word are limited to PI/2
    var nextAngle = PI / 2;
    var previousAngle = PI / 2;
    if (index + 1 < currentCircle.children.length)
        nextAngle = currentCircle.children[index + 1].a;
    if (index >= 1)
        previousAngle = currentCircle.children[index - 1].a;

    return [nextAngle, previousAngle];
}

//manages the movement of circles and lines. In case of circles, correctCircleLocation() is called to enforce language rules
$("canvas").mousemove(function(e) {
    var mouse = getMouse(e);
    if (selectedCircle != null) {
        var selected = selectedCircle;
        var a = Math.atan2(mouse.y - selected.owner.y, mouse.x - selected.owner.x);
        a = normalizeAngle(a);
        var d = dist(mouse, selected.owner);
        if (selected.type != 6 && currentCircle.children.length > 2) {
            var [nextAngle, previousAngle] = getCircleAngleLimits(selectedCircle);
            if (nextAngle > previousAngle) { a > 0 ? previousAngle += 2 * PI : nextAngle -= 2 * PI; }   //still buggy
            if (a - nextAngle > 2 * PI || a - previousAngle > 2 * PI) a -= 2 * PI; if (a - nextAngle < -2 * PI || a - previousAngle < -2 * PI) a += 2 * PI;
            a = a.clamp(nextAngle, previousAngle);
        }
        correctCircleLocation(selected, d, a);
        redraw();
        return;
    }
    if (selectedLine != null) {
        var selected = selectedLine;
        if (lineEnd < 2) { // moving line end
            var minD = 50;
            for (var circle of allCircles) {
                var d = Math.abs(dist(mouse, circle) - circle.r);
                if (d < minD) {
                    var a = Math.atan2(mouse.y - circle.y, mouse.x - circle.x);
                    if (!circle.hasPoint(a))
                        continue;
                    minD = d;
                    selected.updatePoint(lineEnd, circle, a);
                    if (addLineMode)
                        selected.updatePoint((lineEnd+1) % 2, circle, a);	//moving both ends at once looks like a single red dot
                }
            }
        } else { // moving curve anchor
            selected.rel_anchors[lineEnd-2] = {x: mouse.x - selected.points[lineEnd-2].x, y: mouse.y - selected.points[lineEnd-2].y};
        }
        redraw();
        return;
    }
});

//changes the circle's radius
$("canvas").mousewheel(function(event, delta, deltaX, deltaY) {
    if (selectedCircle != null) {

        var selected = selectedCircle;
        var oldR = selected.r;
        if (delta > 0 || deltaX > 0 || deltaY > 0) selected.r += 2; else selected.r -= 2;

        if (selected.isVowel)
            selected.r = selected.r.clamp(10, Infinity);
        else
            selected.r = selected.r.clamp(selected.owner.r * 0.1, Infinity);

        for (var child of selected.children) {
            child.r *= (selected.r / oldR);
            child.update(child.d * (selected.r / oldR), child.a);
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
    var [nextAngle, previousAngle] = getCircleAngleLimits(selectedCircle);
    ctx.strokeStyle = "red";
    drawLine(currentCircle.x, currentCircle.y, ...pointFromAngle(currentCircle, len, nextAngle));
    drawLine(currentCircle.x, currentCircle.y, ...pointFromAngle(currentCircle, len, previousAngle));
    ctx.strokeStyle = "black";
}

//generates the sentence
function generateWords(words) {
    allCircles.push(new Circle({ x: midPoint, y: midPoint, a: 0 }, 4, 0, 0, outerR, 0));
    allCircles[0].selectable = false;

    var delta = 2 * PI / words.length;
    var angle = PI / 2;
    var r = words.length === 1 ? outerR * 0.8 : 2.5 * outerR / (words.length + 4);
    var d = words.length === 1 ? 0 : outerR - r * 1.2;

    for (var word of words) {
        var wordL = 0;  //approximates the number of letters, taking into account that some will be merged
        for (var j = 0; j < word.length; j++) {
            if (j > 0 && word[j].match("^(a|e|i|o|u)$") && !(word[j - 1].match("^(a|e|i|o|u)$"))) continue;
            wordL++;
        }
        generateWord(word, wordL, r, d, angle);

        angle -= delta; angle = normalizeAngle(angle);
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

    var newMainCircle = new Circle(allCircles[0], 2, 0, dist, mcR, mainAngle);

    allCircles.push(newMainCircle);
    allCircles[0].children.push(newMainCircle);

    for (var letter of word) {
        var newCircle = null;
        var owner = newMainCircle;

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
            else if (previous && previous.isConsonant && previous.children.length === 0) {   //are we free to attach?
                type = 6;
                owner = previous;
                angle += delta;
                newCircle = new Circle(owner, type, subtype, owner.r / 2, r, owner.a + PI + PI / 8);
                if ([2, 3, 5].includes(subtype)) newCircle.selectable = false;
            }
            else {  //let's just add this normally then.
                type = 5, d = mcR;
                newCircle = new Circle(owner, type, subtype, owner.r, r, angle);
            }
        }
        if (newCircle === null) continue;  //skip, if the letter wasn't found

        newCircle.nLines = nLines;
        correctCircleLocation(newCircle, newCircle.d, newCircle.a);
        owner.children.push(newCircle);

        allCircles.push(newCircle);

        angle -= delta; angle = normalizeAngle(angle);
    }
}

//checks if a line end is too close to an another line
//will bug out around the PI=-PI point but let's ignore it for now
function isLineTooClose(circle, angle) {
    for (var line of circle.lines) {
        var diff;
        diff = Math.abs(angleDifference(line.points[0].a, angle));
        if (line.points[0].circle === circle && diff < 0.1) return true;
        diff = Math.abs(angleDifference(line.points[1].a, angle));
        if (line.points[1].circle === circle && diff < 0.1) return true;
    }
    return false;
}

//generates the lines after all the circles are created
function createLines() {
    var baseLineAngle = circle => {
        if (circle.type === 6)
            return circle.subtype === 3 ? circle.owner.a + PI : circle.owner.a;
        else if (circle.type === 5)
            return circle.subtype === 3 ? circle.a + PI : circle.a;
        else
            return circle.a + PI;
    }
    var allowedOffset = circle => circle.type === 6 ? PI / 6 : PI / 2;

    var checkedCircles = allCircles.slice(1); // without main circle
    // note: currently bestAngle is not reset. That means a new line may happen to have the same angle as a previous one
    var bestAngle = 0;
    for (var circle of checkedCircles) {
        if (circle.nLines === 0) continue;
        var passes = 0;
        while (circle.lines.length < circle.nLines) {

            //looks for the best path to the base circle if there are no other options left
            if (passes > 100 || (circle.isVowel && circle.subtype === 5)) {

                circle2 = allCircles[0];    //the only one left

                //let's look for the path with the least intersections
                var minInter = 1000;
                for (var n = 0; n < 100; ++n) {
                    var inter = 0;
                    var randAngle = baseLineAngle(circle) + (Math.random() - 0.5) * allowedOffset(circle);
                    var [x, y] = pointFromAngle(circle, circle.r, randAngle);
                    var intersection = findIntersection(circle2.x, circle2.y, circle2.r, x, y, randAngle);
                    var maxT = intersection.t;

                    if (isLineTooClose(circle, randAngle)) continue;
                    if (isLineTooClose(circle2, intersection.a)) continue;

                    for (var circle3 of checkedCircles) {
                        if (circle3 === circle) continue;
                        intersection = findIntersection(circle3.x, circle3.y, circle3.r, x, y, randAngle);
                        if (intersection === 0) continue;
                        if (intersection.t < maxT) inter++;
                    }
                    if (inter < minInter) { minInter = inter; bestAngle = randAngle; }
                }
                var [x, y] = pointFromAngle(circle, circle.r, bestAngle);
                var intersection = findIntersection(circle2.x, circle2.y, circle2.r, x, y, bestAngle);
                lines.push(new Line(circle, bestAngle, circle2, intersection.a));
                if (circle.isVowel) break;
                else continue;
            }
            //normal routine, searches for pairs that still need circles
            for (var circle2 of checkedCircles) {
                if (circle2 === circle) continue;
                if (circle2.lines.length >= circle2.nLines) continue;
                if (circle2.isVowel && circle2.subtype === 5) continue;
                var angle = Math.atan2(circle2.y - circle.y, circle2.x - circle.x);
                var [x, y] = pointFromAngle(circle, circle.r, angle);

                var intersection = findIntersection(circle2.x, circle2.y, circle2.r, x, y, angle);
                if (intersection === 0) continue;
                var angle2 = intersection.a;

                if (Math.floor(Math.random() + 0.6)) continue;  //some extra randomness

                var rand = (Math.random() - 0.5) * PI / 4;
                angle += rand;
                angle2 -= rand;

                if (Math.abs(angleDifference(angle, baseLineAngle(circle))) > allowedOffset(circle))
                    continue;
                if (Math.abs(angleDifference(angle2, baseLineAngle(circle2))) > allowedOffset(circle2))
                    continue;

                if (isLineTooClose(circle, angle)) continue;
                if (isLineTooClose(circle2, angle2)) continue;

                //let's just check if we don't run into a white section of a circle
                if (!circle.hasPoint(angle))
                    continue;
                if (!circle2.hasPoint(angle2))
                    continue;
                //nothing more to check, let's make a line there
                lines.push(new Line(circle, angle, circle2, angle2));

                if (circle.lines.length >= circle.nLines) break;
            }
            passes++;
            if (passes > 103) break;
        }
    }
}

//checks whether all the circles have a correct amount of lines connected
function checkLines() {
    for (var circle of allCircles.slice(1)) {   //we don't check the first circle
        if (circle.isWordCircle) continue; //also skip wordCircles
        if (circle.nLines != circle.lines.length) return 0;
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
    for (var circle of allCircles)
        circle.draw();

    for (var line of lines)
        line.draw();

    if (selectedCircle != null && selectedCircle.type != 6) drawAngles();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dirtyRender) { drawGUI(); }
}