/**
 * Undo Manager for wysihtml5
 * slightly inspired by http://rniwa.com/editing/undomanager.html#the-undomanager-interface
 */
(function(wysihtml5) {
  var Z_KEY               = 90,
      Y_KEY               = 89,
      MAX_HISTORY_ENTRIES = 40,
      CARET_HOLDER        = "wysihtml5-caret-holder",
      UNDO_HTML           = '<span id="_wysihtml5-undo" class="_wysihtml5-temp">' + wysihtml5.INVISIBLE_SPACE + '</span>',
      REDO_HTML           = '<span id="_wysihtml5-redo" class="_wysihtml5-temp">' + wysihtml5.INVISIBLE_SPACE + '</span>',
      dom                 = wysihtml5.dom;
  
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
      this.history = [this.editor.composer.getValue()];
      this.position = 1;
      
      // Undo manager currently only supported in browsers who have the insertHTML command (not IE)
      if (wysihtml5.commands.support("insertHTML")) {
        this._observe();
      }
    },
    
    _observe: function() {
      var that = this,
          doc = this.editor.composer.sandbox.getDocument();
          
      // Catch CTRL+Z and CTRL+Y
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
      
      
      // Now this is very hacky:
      // These days browsers don't offer a undo/redo event which we could hook into
      // to be notified when the user hits undo/redo in the contextmenu.
      // Therefore we simply insert two elements as soon as the contextmenu gets opened.
      // The last element being inserted will be immediately be removed again by a exexCommand("undo")
      //  => When the second element appears in the dom tree then we know the user clicked "redo" in the context menu
      //  => When the first element disappears from the dom tree then we know the user clicked "undo" in the context menu
      dom.observe(this.composerElement, "contextmenu", function() {
        cleanUp();
        wysihtml5.selection.executeAndRestoreSimple(function() {
          if (that.composerElement.lastChild) {
            wysihtml5.selection.setAfter(that.composerElement.lastChild);
          }
          
          // enable undo button in context menu
          doc.execCommand("insertHTML", false, UNDO_HTML);
          // enable redo button in context menu
          doc.execCommand("insertHTML", false, REDO_HTML);
          doc.execCommand("undo", false, null);
        });
        
        interval = setInterval(function() {
          if (doc.getElementById("_wysihtml5-redo")) {
            cleanUp();
            that.redo();
          } else if (!doc.getElementById("_wysihtml5-undo")) {
            cleanUp();
            that.undo();
          }
        }, 400);
        
        if (!observed) {
          observed = true;
          dom.observe(document, "mousedown", cleanUp);
          dom.observe(doc, ["mousedown", "paste", "cut", "copy"], cleanUp);
        }
      });
      
      this.editor
        .observe("newword:composer", function() {
          that.transact();
        })
        
        .observe("beforecommand:composer", function() {
          that.transact();
        });
    },
    
    transact: function() {
      var html = this.editor.composer.getValue();
      if (html == this.history[this.position - 1]) {
        return;
      }
      
      var length = this.history.length = this.position;
      if (length > MAX_HISTORY_ENTRIES) {
        this.history.shift();
        this.position--;
      }
      
      this.position++;
      this.history.push({ html: html });
    },
    
    undo: function() {
      this.transact();
      
      if (this.position <= 1) {
        return;
      }
      
      this.editor.composer.setValue(this.history[--this.position - 1]);
      this.editor.fire("undo:composer");
    },
    
    redo: function() {
      if (this.position >= this.history.length) {
        return;
      }
      
      this.editor.composer.setValue(this.history[++this.position - 1]);
      this.editor.fire("redo:composer");
    }
  });
})(wysihtml5);
