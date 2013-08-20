/**
 * Plugin wrapper.
 * @param {Object} config_opts configuration options
 * @constructor
 */
annotorious.plugin.FancyBoxSelector = function(config_opts) { 
  if (config_opts)
    this._activate = config_opts.activate;
}

/**
 * Attach a new selector onInitAnnotator.
 */
annotorious.plugin.FancyBoxSelector.prototype.onInitAnnotator = function(annotator) {
  annotator.addSelector(new annotorious.plugin.FancyBoxSelector.Selector());
  if (this._activate)
    annotator.setCurrentSelector('fancybox');
}

/**
 * A fancier version of the default box selection tool which 'masks out' the rest of the image
 * while the box is being dragged.
 * @constructor
 */
annotorious.plugin.FancyBoxSelector.Selector = function() { }

/**
 * Initializes the selector.
 * @param {element} canvas the canvas to draw on
 * @param {object} annotator reference to the annotator
 */
annotorious.plugin.FancyBoxSelector.Selector.prototype.init = function(annotator, canvas) {
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
annotorious.plugin.FancyBoxSelector.Selector.prototype._attachListeners = function() {
  var self = this;  
  this._mouseMoveListener = this._canvas.addEventListener('mousemove', function(event) {
    if (self._enabled) {
      self._opposite = (event.offsetX == undefined) ? 
        { x: event.layerX, y: event.layerY } : 
        { x: event.offsetX, y: event.offsetY };

      self._g2d.clearRect(0, 0, self._canvas.width, self._canvas.height);
      
      var top, left, bottom, right;
      if (self._opposite.y > self._anchor.y) {
        top = self._anchor.y;
        bottom = self._opposite.y;
      } else {
        top = self._opposite.y;    
        bottom = self._anchor.y;
      }
      
      if (self._opposite.x > self._anchor.x) {
        right = self._opposite.x;
        left = self._anchor.x;
      } else {
        right = self._anchor.x;   
        left = self._opposite.x;     
      }
      
      var width = right - left;
      var height = bottom - top;
      self._g2d.strokeStyle = '#000000';
      self._g2d.fillStyle = 'rgba(0,0,0,0.45)';
      self._g2d.fillRect(0, 0, self._canvas.width, top);
      self._g2d.fillRect(right, top, (self._canvas.width - right), height);
      self._g2d.fillRect(0, bottom, self._canvas.width, (self._canvas.height - bottom));
      self._g2d.fillRect(0, top, left, height);
      self._g2d.strokeRect(left + 0.5, top + 0.5, width, height);
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
annotorious.plugin.FancyBoxSelector.Selector.prototype._detachListeners = function() {
  if (this._mouseMoveListener)
    delete this._mouseMoveListener;

  if (this._mouseUpListener)
    delete this._UpListener;
}

/**
 * Selector API method: returns the selector name.
 * @returns the selector name
 */
annotorious.plugin.FancyBoxSelector.Selector.prototype.getName = function() {
  return 'fancybox';
}

/**
 * Selector API method: returns the supported shape type.
 * @return the supported shape type
 */
annotorious.plugin.FancyBoxSelector.Selector.prototype.getSupportedShapeType = function() {
  return 'rect';
}

/**
 * Selector API method: starts the selection at the specified coordinates.
 * @param {number} x the X coordinate
 * @param {number} y the Y coordinate
 */
annotorious.plugin.FancyBoxSelector.Selector.prototype.startSelection = function(x, y) {
  this._enabled = true;
  this._attachListeners();
  this._anchor = { x: x, y: y };
  this._annotator.fireEvent('onSelectionStarted', { offsetX: x, offsetY: y });
  document.body.style.webkitUserSelect = 'none';
}

/**
 * Selector API method: stops the selection.
 */
annotorious.plugin.FancyBoxSelector.Selector.prototype.stopSelection = function() {
  this._detachListeners();
  this._g2d.clearRect(0, 0, this._canvas.width, this._canvas.height);
  document.body.style.webkitUserSelect = 'auto';
  delete this._opposite;
}

/**
 * Selector API method: returns the currently edited shape.
 * @returns {annotorious.shape.Shape} the shape
 */
annotorious.plugin.FancyBoxSelector.Selector.prototype.getShape = function() {
  if (this._opposite && 
     (Math.abs(this._opposite.x - this._anchor.x) > 3) && 
     (Math.abs(this._opposite.y - this._anchor.y) > 3)) {
       
    var viewportBounds = this.getViewportBounds();
    var item_anchor = this._annotator.toItemCoordinates({x: viewportBounds.left, y: viewportBounds.top});
    var item_opposite = this._annotator.toItemCoordinates({x: viewportBounds.right - 1, y: viewportBounds.bottom - 1});

    return { type: 'rect', geometry: { x: item_anchor.x, y: item_anchor.y, width: item_opposite.x - item_anchor.x, height: item_opposite.y - item_anchor.y } };
  } else {
    return undefined;
  }
}

/**
 * Selector API method: returns the bounds of the selected shape, in viewport (= pixel) coordinates.
 * @returns {object} the shape viewport bounds
 */
annotorious.plugin.FancyBoxSelector.Selector.prototype.getViewportBounds = function() {
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

annotorious.plugin.FancyBoxSelector.Selector.prototype.drawShape = function(g2d, shape, highlight) {
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

