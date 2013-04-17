/**
 * A fancier version of the default box selection tool which 'masks out' the rest of the image
 * while the box is being dragged.
 * @constructor
 */
FancyBoxSelector = function() { }

/**
 * Initializes the selector.
 * @param {element} canvas the canvas to draw on
 * @param {object} annotator reference to the annotator
 */
FancyBoxSelector.prototype.init = function(annotator, canvas) {
  /** @private **/
  this._canvas = canvas;
  
  /** @private **/
  this._annotator = annotator;

  /** @private **/
  this._g2d = canvas.getContext('2d');
  this._g2d.lineWidth = 1;
 
  /** @private **/
  this._anchor;
  
  /** @private **/
  this._opposite;

  /** @private **/
  this._enabled = false;

  /** @private **/
  this._mouseMoveListener;

  /** @private **/
  this._mouseUpListener;
}

/**
 * Attaches MOUSEUP and MOUSEMOVE listeners to the editing canvas.
 * @private
 */
FancyBoxSelector.prototype._attachListeners = function() {
  var self = this;  
  this._mouseMoveListener = this._canvas.addEventListener('mousemove', function(event) {
    if (self._enabled) {
      self._opposite = { x: event.offsetX, y: event.offsetY };

      self._g2d.clearRect(0, 0, self._canvas.width, self._canvas.height);
      
      var width = self._opposite.x - self._anchor.x;
      var height = self._opposite.y - self._anchor.y;
      
      // TODO make this work in all quadrants
      // TODO make use of width/height vars!
      self._g2d.strokeStyle = '#000000';
      self._g2d.fillStyle = 'rgba(0,0,0,0.4)';
      self._g2d.fillRect(0, 0, self._canvas.width, self._anchor.y);
      self._g2d.fillRect(self._opposite.x, self._anchor.y, (self._canvas.width - self._opposite.x), (self._opposite.y - self._anchor.y));
      self._g2d.fillRect(0, self._opposite.y, self._canvas.width, (self._canvas.height - self._opposite.y));
      self._g2d.fillRect(0, self._anchor.y, self._anchor.x, (self._opposite.y - self._anchor.y));
      self._g2d.strokeRect(self._anchor.x + 0.5, self._anchor.y + 0.5, width, height);
    }
  });

  this._mouseUpListener = this._canvas.addEventListener('mouseup', function(event) {
    self._enabled = false;
    var shape = self.getShape();
    if (shape) {
      self._annotator.fireEvent('onSelectionCompleted',
        { mouseEvent: event, shape: shape, viewportBounds: self.getViewportBounds() }); 
    } else {
      self._annotator.fireEvent('onSelectionCanceled'); 
    }
  });
}

/**
 * Detaches MOUSEUP and MOUSEMOVE listeners from the editing canvas.
 * @private
 */
FancyBoxSelector.prototype._detachListeners = function() {
  if (this._mouseMoveListener) {
    // goog.events.unlistenByKey(this._mouseMoveListener);
    delete this._mouseMoveListener;
  }

  if (this._mouseUpListener) {
    // goog.events.unlistenByKey(this._mouseUpListener);
    delete this._UpListener;
  }
}

/**
 * Selector API method: returns the selector name.
 * @returns the selector name
 */
FancyBoxSelector.prototype.getName = function() {
  return 'fancybox';
}

/**
 * Selector API method: returns the supported shape type.
 *
 * TODO support for multiple shape types?
 *
 * @return the supported shape type
 */
FancyBoxSelector.prototype.getSupportedShapeType = function() {
  return 'rect';
}

/**
 * Selector API method: starts the selection at the specified coordinates.
 * @param {number} x the X coordinate
 * @param {number} y the Y coordinate
 */
FancyBoxSelector.prototype.startSelection = function(x, y) {
  this._enabled = true;
  this._attachListeners();
  this._anchor = { x: x, y: y };
  this._annotator.fireEvent('onSelectionStarted', { offsetX: x, offsetY: y });
  
  // goog.style.setStyle(document.body, '-webkit-user-select', 'none');
  document.body.style.webkitUserSelect = 'none';
}

/**
 * Selector API method: stops the selection.
 */
FancyBoxSelector.prototype.stopSelection = function() {
  this._detachListeners();
  this._g2d.clearRect(0, 0, this._canvas.width, this._canvas.height);
  // goog.style.setStyle(document.body, '-webkit-user-select', 'auto');
  document.body.style.webkitUserSelect = 'auto';
  delete this._opposite;
}

/**
 * Selector API method: returns the currently edited shape.
 * @returns {annotorious.shape.Shape} the shape
 */
FancyBoxSelector.prototype.getShape = function() {
  if (this._opposite && 
     (Math.abs(this._opposite.x - this._anchor.x) > 3) && 
     (Math.abs(this._opposite.y - this._anchor.y) > 3)) {
       
    var viewportBounds = this.getViewportBounds();
    var item_anchor = this._annotator.toItemCoordinates({x: viewportBounds.left, y: viewportBounds.top});
    var item_opposite = this._annotator.toItemCoordinates({x: viewportBounds.right - 1, y: viewportBounds.bottom - 1});
 
    /*
    var rect = new annotorious.shape.geom.Rectangle(
      item_anchor.x,
      item_anchor.y,
      item_opposite.x - item_anchor.x,
      item_opposite.y - item_anchor.y
    );
    */

    return { type: 'rect', geometry: { x: item_anchor.x, y: item_anchor.y, width: item_opposite.x - item_anchor.x, height: item_opposite.y - item_anchor.y } };
    // return new annotorious.shape.Shape(annotorious.shape.ShapeType.RECTANGLE, rect);
  } else {
    return undefined;
  }
}

/**
 * Selector API method: returns the bounds of the selected shape, in viewport (= pixel) coordinates.
 * @returns {object} the shape viewport bounds
 */
FancyBoxSelector.prototype.getViewportBounds = function() {
  var right, left;
  if (this._opposite.x > this._anchor.x) {
    right = this._opposite.x;
    left = this._anchor.x;
  } else {
    right = this._anchor.x;
    left = this._opposite.x;    
  }
  
  var top, bottom;
  if (this._opposite.y > this._anchor.y) {
    top = this._anchor.y;
    bottom = this._opposite.y;
  } else {
    top = this._opposite.y;
    bottom = this._anchor.y;    
  }
  
  return {top: top, right: right, bottom: bottom, left: left};
}

/**
 * TODO not sure if this is really the best way/architecture to handle viewer shape drawing 
 */
FancyBoxSelector.prototype.drawShape = function(g2d, shape, highlight) {
  if (shape.type == 'rect') {
    var color, lineWidth;
    if (highlight) {
      color = '#fff000';
      lineWidth = 1.2;
    } else {
      color = '#ffffff';
      lineWidth = 1;
    }

    var geom = shape.geometry;
    g2d.strokeStyle = '#000000';
    g2d.lineWidth = lineWidth;
    g2d.strokeRect(geom.x + 0.5, geom.y + 0.5, geom.width + 1, geom.height + 1);
    g2d.strokeStyle = color;
    g2d.strokeRect(geom.x + 1.5, geom.y + 1.5, geom.width - 1, geom.height - 1);
  }
}

