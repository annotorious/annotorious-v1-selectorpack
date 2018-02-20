/**
 * Plugin wrapper.
 * @param {Object} config_opts configuration options
 * @constructor
 */
annotorious.plugin.DirectedRectSelector = function(config_opts) { 
  if (config_opts)
    this._activate = config_opts.activate;
}

/**
 * Attach a new selector onInitAnnotator.
 */
annotorious.plugin.DirectedRectSelector.prototype.onInitAnnotator = function(annotator) {
  annotator.addSelector(new annotorious.plugin.DirectedRectSelector.Selector());
  if (this._activate)
    annotator.setCurrentSelector('directed_rect');
}

/**
 * A directed_rect selector.
 * @constructor
 */
annotorious.plugin.DirectedRectSelector.Selector = function() { }

annotorious.plugin.DirectedRectSelector.Selector.prototype.init = function(annotator, canvas) {
  /** @private **/
  this._annotator = annotator;

  /** @private HTML canvas object **/
  this._canvas = canvas;  

  /** @private The 2D context on canvas **/
  this._g2d = canvas.getContext('2d');

  /** @private **/
  this._anchor;
  
  /** @private **/
  this._points = [];

  /** @private **/
  this._mouse;

  /** @private **/
  this._enabled = false;

  /** @private **/
  this._mouseMoveListener;

  /** @private **/
  this._mouseUpListener;
}

annotorious.norm = function(x1, x2) {
    return Math.hypot((x1.y - x2.y), (x1.x - x2.x))
}

function rotatexy_theta(theta, pt) {
   var ctst = { "ct" : Math.cos(theta), "st" : Math.sin(theta)};
   return rotatexy(ctst, pt)
}

function rotatexy(ctst, pt) {
   var ct = ctst.ct, st = ctst.st;
   return { "x" : ct * pt.x - st * pt.y,
             "y" : st * pt.x + ct * pt.y };
}

function scalexy(s, c) {
    return { "x" : c.x * s.x, "y" : c.y * s.y };
}

function shiftxy(shift, pt) {
    return { "x" : shift.x + pt.x, "y" : shift.y + pt.y };
}

function recip(s) {
    return { "x" : 1/s.x, "y" : 1/s.y };
}

function computeParameters(anchor, points, last) {
  // Draw ellipse from three points
  var pt0 = anchor;
  var pt1 = (points.length >= 1) ? points[0] : last;
  var pt2 = last;
  var ry = Math.abs(pt1.y - pt0.y);
  var rx = Math.abs(pt1.x - pt0.x);
  var theta = 0;
  var scale = {"x" : rx, "y" : ry};
  var center = pt0;
  if (rx > 0 && ry > 0) {
     if (points.length >= 1) {
        var hyp = annotorious.norm(pt2, pt0);
        theta = Math.atan2(pt2.y - pt0.y, pt2.x - pt0.x);
        scale = { "x" : hyp , "y" : hyp * ry / rx };
        //center = scalexy(recip(scale), rotatexy_theta(-theta, pt0));
     } else {
        scale = { "x" : rx , "y" : ry };
        var invscale = recip(scale);
        //center = scalexy(invscale, pt0);
     }
  }
  return { "theta" : theta, "scale" : scale, "center" : center };
}

function computeRectangleCorners(theta, scale, center) {
    var majoraxis = rotatexy_theta(
        theta, {"x" : scale.x, "y" : 0 });
    var minoraxis = rotatexy_theta(
        theta, {"x" : 0, "y" : scale.y });
    var axis = {"x" : majoraxis.x + minoraxis.x, "y" : majoraxis.y + minoraxis.y};
    var points = [];
    points.push({ "x" : center.x + majoraxis.x + minoraxis.x,
                  "y" : center.y + majoraxis.y + minoraxis.y});
    points.push({ "x" : center.x - majoraxis.x + minoraxis.x,
                  "y" : center.y - majoraxis.y + minoraxis.y});
    points.push({ "x" : center.x - majoraxis.x - minoraxis.x,
                  "y" : center.y - majoraxis.y - minoraxis.y});
    points.push({ "x" : center.x + majoraxis.x - minoraxis.x,
                  "y" : center.y + majoraxis.y - minoraxis.y});
    return points;
}

function drawFromRectPoints(g2d, rectpoints) {
  g2d.beginPath();
  var r = rectpoints;
  g2d.moveTo((r[0].x + r[1].x + r[2].x + r[3].x)/4,
             (r[0].y + r[1].y + r[2].y + r[3].y)/4);
  g2d.lineTo((rectpoints[0].x + rectpoints[3].x)/2,
            (rectpoints[0].y + rectpoints[3].y)/2);
  for (var i=0; i < rectpoints.length; i++) {
      g2d.lineTo(rectpoints[i].x, rectpoints[i].y);
  }
  g2d.lineTo((rectpoints[0].x + rectpoints[3].x)/2,
            (rectpoints[0].y + rectpoints[3].y)/2);
  g2d.setTransform(1, 0, 0, 1, 0, 0);
  g2d.stroke();
}

function drawFromParametersOnce(g2d, theta, scale, center) {
  var rectpoints = computeRectangleCorners(theta, scale, center);
  drawFromRectPoints(g2d, rectpoints);
}


function drawFromParameters(g2d, theta, scale, center) {
   var outerLineWidth = 2.5, outerStrokeStyle = '#000000',
       innerLineWidth = 1.4, innerStrokeStyle = '#ffffff';
  // Outer drawing
  g2d.lineWidth = outerLineWidth;
  g2d.strokeStyle = outerStrokeStyle;    
  drawFromParametersOnce(g2d, theta, scale, center);

  g2d.lineWidth = innerLineWidth;
  g2d.strokeStyle = innerStrokeStyle;    
  drawFromParametersOnce(g2d, theta, scale, center);
}

/**
 * Attaches MOUSEUP and MOUSEMOVE listeners to the editing canvas.
 * Called on startSelection
 * @private
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype._attachListeners = function() {
  var self = this;  

  var refresh = function(last, highlight_last) {
    // (last.x, last.y) is the point
    self._g2d.clearRect(0, 0, self._canvas.width, self._canvas.height);

    var parameters = computeParameters(self._anchor, self._points, last);
    drawFromParameters(self._g2d, parameters.theta, parameters.scale, parameters.center);

    
    // Last coord highlight (if needed)
    if (highlight_last) {
      self._g2d.lineWidth = 1.0;
      self._g2d.fillStyle = '#ffffff';
      self._g2d.strokeStyle = '#000000';

      self._g2d.beginPath();
      self._g2d.arc(last.x, last.y, 3.5, 0, 2 * Math.PI, false);
      self._g2d.fill();
      self._g2d.stroke();
    }
  };

  // About to close the polygon
  var hasEnoughPoints = function(x, y) {
     return (self._points.length == 1)
  };

  // Refereshed on move of the mouse?
  // FIND: what is event.offsetX ...
  this._mouseMoveListener = function(event) {
    if (self._enabled) {
      if (event.offsetX == undefined) {
        event.offsetX = event.layerX;
        event.offsetY = event.layerY;
      }

      self._mouse = { x: event.offsetX, y: event.offsetY };
      refresh(self._mouse, hasEnoughPoints(event.offsetX, event.offsetY));
    }
  };

  this._canvas.addEventListener('mousemove', this._mouseMoveListener);

  this._mouseUpListener = function(event) {
    if (event.offsetX == undefined) {
      event.offsetX = event.layerX;
      event.offsetY = event.layerY;
    }

    if (hasEnoughPoints(event.offsetX, event.offsetY)) {
      self._enabled = false;
      self._points.push({ x: event.offsetX, y: event.offsetY });
    refresh(self._points[self._points.length - 1]);
      self._annotator.fireEvent('onSelectionCompleted',
        { mouseEvent: event, shape: self.getShape(), viewportBounds: self.getViewportBounds() }); 
    } else {
      self._points.push({ x: event.offsetX, y: event.offsetY });
    }
  };

  this._canvas.addEventListener('mouseup', this._mouseUpListener);
}

/**
 * Detaches MOUSEUP and MOUSEMOVE listeners from the editing canvas.
 * @private
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype._detachListeners = function() {
  var self = this;
  if (this._mouseMoveListener) {
     this._canvas.removeEventListener("mousemove", self._mouseMoveListener);
  }

  if (this._mouseUpListener) {
     this._canvas.removeEventListener("mouseup", self._mouseUpListener);
  }
}

/**
 * Selector API method: returns the selector name.
 * @returns the selector name
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype.getName = function() {
  return 'directed_rect';
}

/**
 * Selector API method: returns the supported shape type.
 *
 * TODO support for multiple shape types?
 *
 * @return the supported shape type
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype.getSupportedShapeType = function() {
  return 'polygon';
}

/**
 * Selector API method: starts the selection at the specified coordinates.
 * @param {number} x the X coordinate
 * @param {number} y the Y coordinate
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype.startSelection = function(x, y) {
  this._enabled = true;
  this._attachListeners();
  this._anchor = { x: x, y: y };
  this._annotator.fireEvent('onSelectionStarted', { offsetX: x, offsetY: y });
  
  // goog.style.setStyle(document.body, '-webkit-user-select', 'none');
}

/**
 * Selector API method: stops the selection.
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype.stopSelection = function() {
  this._points = [];
  this._detachListeners();
  this._g2d.clearRect(0, 0, this._canvas.width, this._canvas.height);
  // goog.style.setStyle(document.body, '-webkit-user-select', 'auto');
}

/**
 * Selector API method: returns the currently edited shape.
 * @returns {annotorious.shape.Shape} the shape
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype.getShape = function() {
  var parameters = computeParameters(this._anchor, this._points, this._points[this._points.length-1]);
    var rectpoints = computeRectangleCorners(
        parameters.theta, parameters.scale, parameters.center);
  var convpoints = [];
  var c = parameters.center;
  for (var i=0; i<rectpoints.length; i++) {
      convpoints.push(
          this._annotator.toItemCoordinates(rectpoints[i]));
  }
  return { type: 'polygon', geometry: { "points" : convpoints } };
}

/**
 * Selector API method: returns the bounds of the selected shape, in viewport (= pixel) coordinates.
 * @returns {object} the shape viewport bounds
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype.getViewportBounds = function() {
  var right = this._anchor.x;
  var left = this._anchor.x;
  var top = this._anchor.y;
  var bottom = this._anchor.y;

  // TODO replace with goog.array.forEach
  for (var i=0; i<this._points.length; i++) {
    var pt = this._points[i];

    if (pt.x > right)
      right = pt.x;

    if (pt.x < left)
      left = pt.x;

    if (pt.y > bottom)
      bottom = pt.y;

    if (pt.y < top)
      top = pt.y;
  };

  return { top: top, right: right, bottom: bottom, left: left };
}

/**
 * TODO not sure if this is really the best way/architecture to handle viewer shape drawing 
 */
annotorious.plugin.DirectedRectSelector.Selector.prototype.drawShape = function(g2d, shape, highlight) {
  var color;
  if (highlight) {
    color = '#fff000';
  } else {
    color = '#ffffff';
  }

  // TODO check if it's really a polyogn
  
  // Outer line
  g2d.lineWidth = 1.3;
  g2d.strokeStyle = '#000000';
 
  var rectpoints = annotorious.geometry.expand(shape, 1.2).geometry.points;
  drawFromRectPoints(g2d, rectpoints);
}
