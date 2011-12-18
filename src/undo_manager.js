(function(wysihtml5) {
  var Z_KEY     = 90,
      Y_KEY     = 89,
      UNDO_HTML = "<span id='_wysihtml5-undo' class='_wysihtml5-temp'>fooo</span>",
      REDO_HTML = "<span id='_wysihtml5-redo' class='_wysihtml5-temp'>baaar</span>",
      dom       = wysihtml5.dom;
  
  function cleanTempElements(doc) {
    var tempElement;
    while (tempElement = doc.querySelector("._wysihtml5-temp")) {
      tempElement.parentNode.removeChild(tempElement);
    }
  }
  
  wysihtml5.UndoManager = wysihtml5.lang.Dispatcher.extend(
    /** @scope wysihtml5.UndoManager.prototype */ {
    constructor: function(editor) {
      this.editor = editor;
      this.composerElement = editor.composer.element;
      this._observe();
    },
    
    _observe: function() {
      var that = this,
          doc = this.editor.composer.sandbox.getDocument();
      dom.observe(this.composerElement, "keydown", function(event) {
        if (!event.ctrlKey && !event.metaKey) {
          return;
        }
        
        var keyCode = event.keyCode,
            isUndo = keyCode === Z_KEY && !event.shiftKey,
            isRedo = (keyCode === Z_KEY && event.shiftKey) || (keyCode === Y_KEY);
        
        if (isUndo) {
          that.undo();
          event.preventDefault();
        } else if (isRedo) {
          that.redo();
          event.preventDefault();
        }
      });
      
      var interval, observed, cleanUp = function() {
        cleanTempElements(doc);
        clearInterval(interval);
      };
      
      dom.observe(this.composerElement, "contextmenu", function() {
        // cleanUp();
        // setTimeout(function() {
        //           doc.execCommand("insertHTML", false, "foo");
        //         }, 0);
        //         // doc.execCommand("insertHTML", "bar");
        //         console.log("CONTEXT MENU 4");
        return;
        // doc.execCommand("undo");
        
        // interval = setInterval(function() {
        //           console.log(doc.getElementById("_wysihtml5-redo"),doc.getElementById("_wysihtml5-undo"));
        //           if (doc.getElementById("_wysihtml5-redo")) {
        //             cleanUp();
        //             that.redo();
        //           } else if (!doc.getElementById("_wysihtml5-undo")) {
        //             cleanUp();
        //             that.undo();
        //           }
        //         }, 400);
        //         
        //         if (!observed) {
        //           observed = true;
        //           dom.observe(document, "mousedown", cleanUp);
        //           dom.observe(doc, "mousedown", cleanUp);
        //         }
      });
      
    },
    
    undo: function() {
      this.editor.fire("undo:composer");
    },
    
    redo: function() {
      this.editor.fire("redo:composer");
    }
  });
})(wysihtml5);
