"use strict";
function findIntersection(cX, cY, cR, x0, y0, a) {
    //firstly, let's make a line vector
    var vec = { x: 100 * Math.cos(a), y: 100 * Math.sin(a) };
    var x1 = x0 + vec.x, y1 = y0 + vec.y

    //at^2+bt+c=0
    //a=(x1-x0)^2+(y1-y0)^2
    //b=2(x1-x0)(x0-cX)+2(y1-y0)(y0-cY)
    //c=(x0-cX)^2+(y0-cY)^2-r^2

    var a = (x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0),
        b = 2 * (x1 - x0) * (x0 - cX) + 2 * (y1 - y0) * (y0 - cY),
        c = (x0 - cX) * (x0 - cX) + (y0 - cY) * (y0 - cY) - cR * cR;

    //t=(-b+-sqrt(b^2-4ac))/(2a)

    if ((b * b - 4 * a * c) <= 0) return 0;	//no intersection

    var t1 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a),
        t2 = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);

    if (t1 < 0 && t2 < 0) return 0;

    var p1 = { t: t1, x: x0 + t1 * vec.x, y: y0 + t1 * vec.y },
        p2 = { t: t2, x: x0 + t2 * vec.x, y: y0 + t2 * vec.y };

    p1.a = Math.atan2(p1.y - cY, p1.x - cX);
    p2.a = Math.atan2(p2.y - cY, p2.x - cX);

    if (t1 < 0) return p2;
    if (t2 < 0) return p1;
    if (t1 < t2) return p1; else return p2;
}