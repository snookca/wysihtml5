(function(wysihtml5) {
  var PLACEHOLDER_TEXT = "--_CARET_--",
      dom              = wysihtml5.dom;
  
      // ----------------- private -------------- \\
  function _createPlaceholderNode(doc) {
    // Important: placeholder element needs to be an inline element
    // otherwise chrome will cause trouble when interacting with the text
    var element       = doc._wysihtml5CaretPlaceholder = (doc._wysihtml5CaretPlaceholder || doc.createElement("span"));
    element.innerHTML = PLACEHOLDER_TEXT;
    return element;
  }

  function _findPlaceholderNode(doc) {
    var placeholderElement      = _createPlaceholderNode(doc),
        // Using placeholderElement.innerHTML causes problems in firefox who sometimes mangles the innerHTML
        placeholderElementText  = dom.getTextContent(placeholderElement),
        placeholderElementById  = doc.getElementById(placeholderElement.id),
        i                       = 0,
        element,
        elements,
        elementsLength;
    if (dom.contains(doc.body, placeholderElement)) {
      return placeholderElement;
    } else if (placeholderElementById) {
      return placeholderElementById;
    } else {
      elements = doc.getElementsByTagName("*");
      elementsLength = elements.length;
      for (; i<elementsLength; i++) {
        element = elements[i];
        if (element.innerHTML === placeholderElementText) {
          return element;
        }
      }
      return null;
    }
  }
  
  function _getCumulativeOffsetTop(element) {
    var top = 0;
    if (element.parentNode) {
      do {
        top += element.offsetTop || 0;
        element = element.offsetParent;
      } while (element);
    }
    return top;
  }
  
  wysihtml5.selection = {
    PLACEHOLDER_TEXT: PLACEHOLDER_TEXT,
    
    /**
     * Setup selection for editor
     *
     * @param {Object} doc Document object of the context
     */
    initialize: function(doc) {
      // Make sure that our external range library is initialized
      window.rangy.init();
      
      this.doc = doc;
    },
    
    /**
     * Get the current selection as a bookmark to be able to later restore it
     *
     * @return {Object} An object that represents the current selection
     */
    getBookmark: function() {
      var range = this.getRange();
      return range && range.cloneRange();
    },

    /**
     * Restore a selection retrieved via wysihtml5.selection.getBookmark
     *
     * @param {Object} bookmark An object that represents the current selection
     */
    setBookmark: function(bookmark) {
      if (!bookmark) {
        return;
      }

      this.setSelection(bookmark);
    },

    /**
     * Set the caret in front of the given node
     *
     * @param {Object} node The element or text node where to position the caret in front of
     * @example
     *    wysihtml5.selection.setBefore(myElement);
     */
    setBefore: function(node) {
      var range = rangy.createRange(this.doc);
      range.setStartBefore(node);
      range.setEndBefore(node);
      return this.setSelection(range);
    },

    /**
     * Set the caret after the given node
     *
     * @param {Object} node The element or text node where to position the caret in front of
     * @example
     *    wysihtml5.selection.setBefore(myElement);
     */
    setAfter: function(node) {
      var range = rangy.createRange(this.doc);
      range.setStartAfter(node);
      range.setEndAfter(node);
      return this.setSelection(range);
    },

    /**
     * Ability to select/mark nodes
     *
     * @param {Element} node The node/element to select
     * @example
     *    wysihtml5.selection.selectNode(document.getElementById("my-image"));
     */
    selectNode: function(node) {
      var range           = rangy.createRange(this.doc),
          isElement       = node.nodeType === wysihtml5.ELEMENT_NODE,
          canHaveHTML     = "canHaveHTML" in node ? node.canHaveHTML : (node.nodeName !== "IMG"),
          content         = isElement ? node.innerHTML : node.data,
          isEmpty         = (content === "" || content === wysihtml5.INVISIBLE_SPACE),
          displayStyle    = dom.getStyle("display").from(node),
          isBlockElement  = (displayStyle === "block" || displayStyle === "list-item");

      if (isEmpty && isElement && canHaveHTML) {
        // Make sure that caret is visible in node by inserting a zero width no breaking space
        try { node.innerHTML = wysihtml5.INVISIBLE_SPACE; } catch(e) {}
      }

      if (canHaveHTML) {
        range.selectNodeContents(node);
      } else {
        range.selectNode(node);
      }

      if (canHaveHTML && isEmpty && isElement) {
        range.collapse(isBlockElement);
      } else if (canHaveHTML && isEmpty) {
        range.setStartAfter(node);
        range.setEndAfter(node);
      }

      this.setSelection(range);
    },

    /**
     * Get the node which contains the selection
     *
     * @param {Boolean} [controlRange] (only IE) Whether it should return the selected ControlRange element when the selection type is a "ControlRange"
     * @return {Object} The node that contains the caret
     * @example
     *    var nodeThatContainsCaret = wysihtml5.selection.getSelectedNode();
     */
    getSelectedNode: function(controlRange) {
      var selection,
          range;

      if (controlRange && this.doc.selection && this.doc.selection.type === "Control") {
        range = this.doc.selection.createRange();
        if (range && range.length) {
          return range.item(0);
        }
      }

      selection = this.getSelection(this.doc);
      if (selection.focusNode === selection.anchorNode) {
        return selection.focusNode;
      } else {
        range = this.getRange(this.doc);
        return range ? range.commonAncestorContainer : this.doc.body;
      }
    },

    executeAndRestore: function(method, restoreScrollPosition) {
      if (!window.getSelection) {
        return this.executeAndRestoreSimple(method);
      }

      var body                = this.doc.body,
          oldScrollTop        = body.scrollTop,
          oldScrollLeft       = body.scrollLeft,
          range               = this.getRange(),
          caretPlaceholder    = _createPlaceholderNode(this.doc),
          newCaretPlaceholder,
          newRange;

      // Nothing selected, execute and say goodbye
      if (!range) {
        method(body, body);
        return;
      }

      range.insertNode(caretPlaceholder);

      // Make sure that a potential error doesn't cause our placeholder element to be left as a placeholder
      try {
        method(range.startContainer, range.endContainer);
      } catch(e1) {
        setTimeout(function() { throw e1; }, 0);
      }

      // range.detach();

      newCaretPlaceholder = _findPlaceholderNode(this.doc);

      if (newCaretPlaceholder) {
        newRange = rangy.createRange(this.doc);
        newRange.selectNode(newCaretPlaceholder);
        newRange.deleteContents();
        this.setSelection(newRange);
      }

      if (restoreScrollPosition) {
        body.scrollTop  = oldScrollTop;
        body.scrollLeft = oldScrollLeft;
      }

      // Remove it again, just to make sure that the placeholder is definitely out of the dom tree
      try {
        newCaretPlaceholder.parentNode.removeChild(newCaretPlaceholder);
      } catch(e2) {}
    },

    /**
     * Different approach of preserving the selection (doesn't modify the dom)
     * Takes all text nodes in the selection and saves the selection position in the first and last one
     */
    executeAndRestoreSimple: function(method) {
      var range = this.getRange(),
          body  = this.doc.body,
          newRange,
          firstNode,
          lastNode,
          textNodes,
          rangeBackup;

      // Nothing selected, execute and say goodbye
      if (!range) {
        method(body, body);
        return;
      }

      textNodes = range.getNodes([3]);
      firstNode = textNodes[0] || range.startContainer;
      lastNode  = textNodes[textNodes.length - 1] || range.endContainer;

      rangeBackup = {
        collapsed:      range.collapsed,
        startContainer: firstNode,
        startOffset:    firstNode === range.startContainer ? range.startOffset : 0,
        endContainer:   lastNode,
        endOffset:      lastNode === range.endContainer ? range.endOffset : lastNode.length
      };

      try {
        method(range.startContainer, range.endContainer);
      } catch(e) {
        setTimeout(function() { throw e; }, 0);
      }

      newRange = rangy.createRange(this.doc);
      try { newRange.setStart(rangeBackup.startContainer, rangeBackup.startOffset); } catch(e1) {}
      try { newRange.setEnd(rangeBackup.endContainer, rangeBackup.endOffset); } catch(e2) {}
      try { this.setSelection(newRange); } catch(e3) {}
    },

    /**
     * Insert html at the caret position and move the cursor after the inserted html
     *
     * @param {String} html HTML string to insert
     * @example
     *    wysihtml5.selection.insertHTML("<p>foobar</p>");
     */
    insertHTML: function(html) {
      var range     = rangy.createRange(this.doc),
          node      = range.createContextualFragment(html),
          lastChild = node.lastChild;
      this.insertNode(node);
      if (lastChild) {
        this.setAfter(lastChild);
      }
    },

    /**
     * Insert a node at the caret position and move the cursor after it
     *
     * @param {Object} node HTML string to insert
     * @example
     *    wysihtml5.selection.insertNode(document.createTextNode("foobar"));
     */
    insertNode: function(node) {
      var range = this.getRange();
      if (range) {
        range.insertNode(node);
      } else {
        return false;
      }
    },

    /**
     * Wraps current selection with the given node
     *
     * @param {Object} node The node to surround the selected elements with
     */
    surround: function(node) {
      var range = this.getRange();
      if (!range) {
        return;
      }

      try {
        // This only works when the range boundaries are not overlapping other elements
        range.surroundContents(node);
        this.selectNode(node);
      } catch(e) {
        // fallback
        node.appendChild(range.extractContents());
        range.insertNode(node);
      }
    },

    /**
     * Scroll the current caret position into the view
     * FIXME: This is a bit hacky, there might be a smarter way of doing this
     *
     * @param {Object} element A scrollable element in which the caret is currently positioned
     * @example
     *    wysihtml5.selection.scrollIntoView(element);
     */
    scrollIntoView: function(element) {
      var doc           = this.doc,
          hasScrollBars = doc.documentElement.scrollHeight > doc.documentElement.offsetHeight,
          tempElement   = doc._wysihtml5ScrollIntoViewElement = doc._wysihtml5ScrollIntoViewElement || (function() {
            var element = doc.createElement("span");
            // The element needs content in order to be able to calculate it's position properly
            element.innerHTML = wysihtml5.INVISIBLE_SPACE;
            return element;
          })(),
          offsetTop;

      if (hasScrollBars) {
        this.insertNode(tempElement);
        offsetTop = _getCumulativeOffsetTop(tempElement);
        tempElement.parentNode.removeChild(tempElement);
        if (offsetTop > element.scrollTop) {
          element.scrollTop = offsetTop;
        }
      }
    },

    /**
     * Select line where the caret is in
     */
    selectLine: function() {
      if (wysihtml5.browser.supportsSelectionModify()) {
        this._selectLine_W3C();
      } else if (this.doc.selection) {
        this._selectLine_MSIE();
      }
    },

    /**
     * See https://developer.mozilla.org/en/DOM/Selection/modify
     */
    _selectLine_W3C: function() {
      var win       = this.doc.defaultView,
          selection = win.getSelection();
      selection.modify("extend", "left", "lineboundary");
      selection.modify("extend", "right", "lineboundary");
    },

    _selectLine_MSIE: function() {
      var range       = this.doc.selection.createRange(),
          rangeTop    = range.boundingTop,
          rangeHeight = range.boundingHeight,
          scrollWidth = this.doc.body.scrollWidth,
          rangeBottom,
          rangeEnd,
          measureNode,
          i,
          j;

      if (!range.moveToPoint) {
        return;
      }

      if (rangeTop === 0) {
        // Don't know why, but when the selection ends at the end of a line
        // range.boundingTop is 0
        measureNode = this.doc.createElement("span");
        this.insertNode(measureNode);
        rangeTop = measureNode.offsetTop;
        measureNode.parentNode.removeChild(measureNode);
      }

      rangeTop += 1;

      for (i=-10; i<scrollWidth; i+=2) {
        try {
          range.moveToPoint(i, rangeTop);
          break;
        } catch(e1) {}
      }

      // Investigate the following in order to handle multi line selections
      // rangeBottom = rangeTop + (rangeHeight ? (rangeHeight - 1) : 0);
      rangeBottom = rangeTop;
      rangeEnd = this.doc.selection.createRange();
      for (j=scrollWidth; j>=0; j--) {
        try {
          rangeEnd.moveToPoint(j, rangeBottom);
          break;
        } catch(e2) {}
      }

      range.setEndPoint("EndToEnd", rangeEnd);
      range.select();
    },

    getText: function() {
      var selection = this.getSelection();
      return selection ? selection.toString() : "";
    },

    getNodes: function(nodeType, filter) {
      var range = this.getRange();
      if (range) {
        return range.getNodes([nodeType], filter);
      } else {
        return [];
      }
    },

    getRange: function() {
      var selection = this.getSelection();
      return selection && selection.rangeCount && selection.getRangeAt(0);
    },

    getSelection: function() {
      return rangy.getSelection(this.doc.defaultView || this.doc.parentWindow);
    },

    setSelection: function(range) {
      var win       = this.doc.defaultView || this.doc.parentWindow,
          selection = rangy.getSelection(win);
      return selection.setSingleRange(range);
    }
  };
  
})(wysihtml5);

