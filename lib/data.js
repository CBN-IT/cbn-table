(function(scope) {
	
	/**
	 * Defines the table's built-in data types.
	 * 
	 * This maps the type to a descriptor object that defines several data processing callbacks:
	 * 
	 * - `column(column, colDesc)`: you can use this object to pre-process the column object;
	 * - `value(item, column)`: this callback is used to fetch the cell's value from the row object; 
	 *    by default, the `column.name` property will be read from the `item` object;
	 *    the value returned here will be used for both filtering and sorting;
	 * - `display(val, column)`: returns a string representation of the item's value;
	 * - `filter(val, expression, column)`: returns true if the value matches the specified expression;
	 * - `compare(val1, val2, column)`: compares two values and returns -1, 0 or 1 if the first is less than / equal / 
	 *    greater than the second; used for sorting;
	 * 
	 * Each data type can also have a `filters` object which defines named methods to use for filtering its values.
	 * 
	 * See [docs/data-table.md] for a more detailed documentation of the data processing model.
	 * 
	 * @type {Object}
	 */
	scope.DataTypes = {
		// defaults:
		"_": {
			value: function(item, column) { return item[column.name]; },
			filter: null, /* hardcoded, for performance */
			compare: function(val1, val2/*, column*/) {
				return ( val1 < val2 ? -1 : ( val1 > val2 ? 1 : 0 ) );
			},
			display: function(val/*, column*/) { return (val || val === 0 ? val + '' : '' ); },
			
			/**
			 * Built-in filters.
			 */
			filters: {
				"equals": function(val, expr) {
					return val == expr;
				},
				"equals-ci": function(val, expr) {
					return (val + '').toLowerCase() == (expr + '').toLowerCase();
				},
				
				"contains": function(val, expr) {
					return (val + '').indexOf(expr) != -1;
				},
				"contains-ci": function(val, expr) {
					return (val + '').toLowerCase().indexOf(expr) != -1;
				}
			}
		},
		
		// a special type for printing the column's index
		"index": {
			value: function(/*item, column*/) { return null; },
			filter: false, compare: false // unfilterable / unsortable
		},
		
		// like index above (unfilterable, unsortable, no value), but without the automatic value
		// can be used with non-data / purely cosmetic columns
		"inert": {
			value: function(/*item, column*/) { return null; },
			filter: false, compare: false // unfilterable / unsortable
		},
		
		"boolean": {
			value: function(item, column) { return !!item[column.name]; }
		},
		
		"string": {
			value: function(item, column) {
				var val;
				if (column.name.indexOf(".") > -1) {
					var itms = column.name.split(".");
					val = item;
					for (var i = 0; i < itms.length; i++) {
						val = val[itms[i]];
					}
				} else {
					val = item[column.name];
				}
				return (val || val === 0 || val === false ? val+'' : '');
			},
			compare: function(val1, val2/*, column*/) {
				return val1.localeCompare(val2);
			}
		},
		"natural": { // note: case insensitive!
			value: function(item, column) {
				var val = item[column.name];
				val = (val || val === 0 || val === false ? val+'' : '');
				return {
					text: val,
					chunks: scope.utils.naturalChunks(val, true)
				};
			},
			compare: function(val1, val2) {
				return scope.utils.compareNaturalChunks(val1.chunks, val2.chunks);
			},
			filter: function(val, expression, column) {
				if (!column._f_userFilter) return true;
				// proxy the original, user filter
				return column._f_userFilter.call(this, val.text, expression, column);
			},
			display: function(val) { return val.text; }
		},
		
		"integer": {
			value: function(item, column) {
				var val = parseInt(item[column.name]);
				if (isNaN(val)) return null;
				return val;
			}
		},
		"float": {
			value: function(item, column) {
				var val = parseFloat(item[column.name]);
				if (isNaN(val)) return null;
				return val;
			}
		},
		
		"date": { // requires Moment JS for parsing dates
			column: function(column) {
				// infer column settings defaults
				column.dateFormat = column['dateFormat'] || "DD.MM.YYYY";
				column.dateValueFormat = column['dateValueFormat'] || column.dateFormat;
			},
			value: function(item, column) {
				var val = item[column.name];
				if (!val) return null;
				//noinspection JSUnresolvedFunction
				return moment(val, column.dateValueFormat);
			},
			display: function (val, column) {
				if (val == null) {
					return "";
				}
				return val.format(column.dateFormat)
			}
		}
	};
	
	/**
	 * The default values for the column descriptor object.
	 * @type {Object}
	 */
	scope.ColumnDefaults = {
			name: '', // will be auto-generated based on its index
			caption: '',
			visible: true,
			headStyle: '',
			style: '',
			renderAs: 'text',
			template: '',
			type: 'string',
			filter: 'contains-ci',
			filterElement: false,
			sortable: true
		};
	
	//noinspection JSUnusedGlobalSymbols
	/**
	 * A behavior that implements filtering & sorting features for `cbn-data-table`.
	 * 
	 * @type {Object}
	 */
	scope.DataProcessingBehavior = {
		
		properties: {
			
			/**
			 * Stores the currently enabled data filters (map with the column's name + filtered value).
			 * You can also modify this externally to apply custom filtering.
			 */
			dataFilters: {
				type: Object,
				value: function() { return {}; }
			},
			
			/**
			 * Stores the current column ordering.
			 * 
			 * The array contains simple objects that define the column's name (using the `name` property) and its sorting 
			 * direction (the `dir` property, which can be true for ascending, false for descending).
			 */
			sortOrdering: {
				type: Array,
				value: function() { return []; }
			},
			
			/**
			 * A Weak Map that stores metadata associated with table's items.
			 */
			_itemsMeta: {
				type: Object,
				readOnly: true,
				value: function() {
					return new WeakMap();
				}
			},
			
			/**
			 * Caches the sort.
			 */
			_sortCache: {
				type: Object,
				value: function() { return {}; }
			},
			
			/**
			 * The actual visible items (that resulted from filtering, if enabled).
			 */
			_filteredItems: {
				type: Array,
				value: function() { return []; }
			},
			
			/**
			 * The internal representation of the columns.
			 */
			_columns: {
				type: Array,
				value: function() { return []; }
			}
			
		},
		
		observers: [
			"_intColumnPathChanged(_columns.*)",
			"_itemsArrayChanged(items.splices)",
			"_applyFilter(items.*, dataFilters.*, sortOrdering.*)"
		],
		
		/**
		 * Returns an item's metadata. Uses the internal WeakMap for caching.
		 * 
		 * @param {Object} item The item object.
		 * @return {Object} The item's computed metadata.
		 */
		getItemMeta: function(item) {
			var meta = this._itemsMeta.get(item);
			if (meta) return meta;
			
			meta = {
				/** A map of processed values. */
				values: {},
				
				/** The processed display values. */
				display: {}
			};
			
			this._columns.forEach(function(colDesc) {
				var column = colDesc.obj;
				if (!column.name) return;
				
				var val = null;
				if (column._f_value) {
					val = column._f_value(item, column);
					meta.values[column.name] = val;
				}
				if (column._f_display) {
					meta.display[column.name] = column._f_display(val, column);
				}
			});
			
			// cache it inside the weak map
			this._itemsMeta.set(item, meta);
			return meta;
		},
		
		/**
		 * Filters the data using the specified parameters.
		 * 
		 * If auto-filtering / sorting is enabled, the parameters are automatically populated from the user interface.
		 * 
		 * Available options:
		 * - sortCache: whether to use sort caching; defaults to true.
		 * 
		 * @param {Object} [dataFilters] The data filters to use. Defaults to table UI's active filters.
		 * @param {Array}  [ordering] The columns to sort by. Defaults to table UI-specified sorting order.
		 * @param {Object} [options] Optional filtering / sorting options.
		 */
		filter: function(dataFilters, ordering, options) {
			var i, j, n, m, column, item, meta, pass;
			
			var defaultOptions = {
				sortCache: true
			};
			if (!options) options = {};
			Object.getOwnPropertyNames(defaultOptions).forEach(function(n) {
				if (options[n] === undefined)
					options[n] = defaultOptions[n];
			});
			
			if (!dataFilters) dataFilters = this.dataFilters;
			if (!ordering) ordering = /**@type {Array}*/this.sortOrdering;
			
			var sortOptions = null;
			var sortCacheKey = '';
			var compareFunc = null;
			if (ordering.length) {
				sortOptions = [];
				sortCacheKey = [];
				for (i = 0; i < ordering.length; i++) {
					for (j = 0, m = this._columns.length; j < m; j++) {
						column = this._columns[j].obj;
						if (column._f_compare && ordering[i].name == column.name) {
							sortOptions.push({
								column: column,
								direction: ordering[i].dir
							});
							sortCacheKey.push(column.name + "|" + 
								(ordering[i].dir ? "A" : "D") + "|");
							break;
						}
					}
				}
				sortCacheKey = sortCacheKey.join('|');
				compareFunc = this._generateCompareFunc(sortOptions);
			}
			
			var itemsSource;
			var filteredItems;
			var sorted = false; // whether the source list is already sorted
			if (!this.items) {
				itemsSource = []; // nothing to do...
				sorted = true;
			} else if (this._sortCache[sortCacheKey]) {
				itemsSource = this._sortCache[sortCacheKey];
				sorted = true;
			} else {
				itemsSource = this.items;
			}
			
			// sort the items (if enabled)
			if (sortOptions && !sorted) {
				itemsSource = itemsSource.slice();
				itemsSource.sort(compareFunc);
				
				// cache it
				this._sortCache[sortCacheKey] = itemsSource;
			}
			
			// filter the items (if enabled)
			if (!scope.utils._isEmptyObject(dataFilters)) {
				var filteredColumns = [];
				filteredItems = [];
				
				for (j=0; j<this._columns.length; j++) {
					column = this._columns[j].obj;
					if (dataFilters.hasOwnProperty(column.name)) {
						filteredColumns.push(column);
					}
				}
				
				n = itemsSource.length;
				m = filteredColumns.length;
				for (i=0; i<n; i++) {
					item = itemsSource[i];
					meta = this.getItemMeta(item);
					pass = true;
					for (j=0; j<m; j++) {
						column = filteredColumns[j];
						if (!column._f_filter) continue;
						if (!column._f_filter(meta.values[column.name], dataFilters[column.name], column)) {
							pass = false;
							break;
						}
					}
					if (pass) {
						filteredItems.push(item);
					}
				}
			} else {
				// skip filtering
				filteredItems = itemsSource.slice();
			}
			this.set('_filteredItems', filteredItems);
		},
		
		/**
		 * Toggles the sorting on the specified column.
		 * 
		 * @param {String} name The name of the column to toggle.
		 * @param {Boolean} [append=false] Append to the criteria list or simply reset it?
		 */
		toggleOrdering: function(name, append) {
			var exists = -1, direction = true;
			
			this.sortOrdering.forEach(function(ordering, idx) {
				if (ordering.name == name) {
					exists = idx;
					direction = ordering.dir;
					return true;
				}
				return false;
			});
			
			if (append) {
				if (exists > -1) {
					this.set('sortOrdering.'+exists+'.dir', !direction);
				} else {
					this.push('sortOrdering', { name: name, dir: direction });
				}
				
			} else {
				if (exists > -1) {
					direction = !direction;
				}
				this.sortOrdering = [ { name: name, dir: direction } ];
			}
		},
		
		/**
		 * Generates the comparison function used for sorting.
		 * 
		 * @param {Array} sortOptions The sorting criteria to use.
		 * @return {Function} The comparison function to use. 
		 */
		_generateCompareFunc: function(sortOptions) {
			var m = sortOptions.length;
			return function(item1, item2) {
				var meta1 = this.getItemMeta(item1);
				var meta2 = this.getItemMeta(item2);
				var j, res;
				
				for (j=0; j<m; j++) {
					var column = sortOptions[j].column;
					var dir = sortOptions[j].direction;
					res = column._f_compare(meta1.values[column.name], meta2.values[column.name], column);
					if (!dir) res = -res;
					if (res != 0) { // strict ordering
						return res;
					}
					// else: try the next ordering criteria
				}
				return res;
				
			}.bind(this)
		},
		
		/**
		 * Processes the specified columns, storing them inside the internal `_columns` property.
		 * 
		 * @see _processColumn
		 * @param {Array} columns The user-defined columns.
		 */
		_processColumns: function(columns) {
			var columnDescriptors = [];
			for (var i=0; i<columns.length; i++) {
				var colDesc = {
					// workaround for Polymer not supporting direct array bindings
					obj: {},
					
					/**
					 * Stores the current filter expression (for use in data bindings).
					 */
					currentFilter: ''
				};
				// clone the user-defined column properties
				scope.utils._copyProperties(colDesc.obj, this.columns[i]);
				
				// normalize/process it
				colDesc.obj._index = i;
				this._processColumn(colDesc.obj, colDesc);
				
				columnDescriptors.push(colDesc);
			}
			this.set('_columns', columnDescriptors);
		},
		
		/**
		 * Pre-processes the given column, normalizing its properties and enabling features based on the column's data 
		 * type.
		 * 
		 * Returns a column descriptor.
		 * 
		 * @param {Object} column The column object to pre-process.
		 * @param {Object} colDesc The column descriptor, together with view properties.
		 * @return {Object} The processed column's descriptor.
		 */
		_processColumn: function(column, colDesc) {
			// infer defaults
			Object.getOwnPropertyNames(scope.ColumnDefaults).forEach(function(n) {
				if (column[n] === undefined)
					column[n] = scope.ColumnDefaults[n];
			});
			if (!column.name)
				column.name = '_column_id' + column._index;
			
			// bind the callback functions
			var du = scope.DataTypes['_'];
			var dt = scope.DataTypes[column.type];
			
			column._filters = {};
			scope.utils._copyProperties(column._filters, du.filters);
			if (dt.filters) {
				scope.utils._copyProperties(column._filters, dt.filters);
			}
			
			column._f_value = scope.utils.defaultVal(dt.value, du.value);
			column._f_display = scope.utils.defaultVal(dt.display, du.display);
			if (column.filter) {
				if (dt.filter === false) {
					column._f_filter = false;
				} else if (typeof column.filter == 'function') {
					column._f_filter = column.filter;
				} else if (typeof column.filter == 'string' && column._filters[column.filter]) {
					column._f_filter = column._filters[column.filter];
				}
				if (dt.filter) {
					column._f_userFilter = column._f_filter;
					column._f_filter = dt.filter;
				}
				if (!column._f_filter) {
					column.filter = false;
				}
			}
			
			column._f_compare = scope.utils.defaultVal(dt.compare, du.compare);
			if (!column._f_compare)
				column.sortable = false;
			
			// call the `column` processing callback, if available
			if (dt.column) {
				dt.column.call(this, column, colDesc);
			}
		},
		
		/**
		 * Called when a path inside `_columns` is changed (e.g. the filter value).
		 * 
		 * @param {Object} changes The Polymer changes structure.
		 */
		_intColumnPathChanged: function(changes) {
			var filterPath = /^_columns\.#([0-9]+)\.currentFilter$/;
			var res = filterPath.exec(changes.path);
			
			if (res) {
				var idx = res[1]*1;
				if (idx >= this._columns.length) return;
				
				var colDesc = this._columns[idx];
				this.set('dataFilters.' + colDesc.obj.name, colDesc.currentFilter);
			}
		},
		
		/**
		 * Called when the `items` array is changed.
		 * Used to clean up cache structures.
		 */
		_itemsArrayChanged: function() {
			this._sortCache = {};
		},
		
		/**
		 * Used to re-filter / sort the table after any of those parameters changes.
		 */
		_applyFilter: function() {
			this.filter();
		}
		
	};
	
	/**
	 * Utility functions.
	 * 
	 * @type {Object}
	 */
	scope.utils = {
		
		/**
		 * Copies the properties of an object into another.
		 * 
		 * @param obj The destination object.
		 * @param source The source object.
		 */
		_copyProperties: function(obj, source) {
			Object.getOwnPropertyNames(source).forEach(function(n) {
				obj[n] = source[n];
			});
		},
		
		/**
		 * Returns whether the specified plain JavaScript object is empty (has no own keys).
		 * 
		 * @param {Object} obj The object to test.
		 * @return {Boolean} True if empty.
		 */
		_isEmptyObject: function(obj) {
			return Object.getOwnPropertyNames(obj).length == 0;
		},
		
		/**
		 * Infers a default value if the given value is undefined.
		 * 
		 * @param {*} value The source value.
		 * @param {*} defValue The default value if value is undefined.
		 * @return {*} The resulting value.
		 */
		defaultVal: function(value, defValue) {
			return ((value === undefined) ? defValue : value);
		},
		
		/**
		 * Splits a string into separate chunks of text and/or numbers.
		 * Used to implement natural comparison / sorting.
		 * 
		 * @param {String} value The value to tokenize.
		 * @param {Boolean} [caseInsensitive] Set to true to convert all chunks to lowercase.
		 * @return {Array} The separate string/number tokens.
		 */
		naturalChunks: function(value, caseInsensitive) {
			var chunks = [];
			if (!value) return chunks;
			if (caseInsensitive)
				value = (value+'').toLowerCase();
			else value = value + '';
			
			var lastChunkNumber = false;
			function appendTextChunk(text) {
				if (lastChunkNumber || chunks.length == 0) {
					chunks.push(text);
					lastChunkNumber = false;
				} else {
					chunks[chunks.length - 1] += text;
				}
			}
			
			var numberRe = /^(\d+(?:\.\d*)?)/, othersRe = /^([^\d.]+)/;
			var rest = value, res;
			while (rest) {
				if ((res = numberRe.exec(rest))) {
					chunks.push(res[1] * 1);
					lastChunkNumber = true;
					rest = rest.substring(res[0].length);
				} else if ((res = othersRe.exec(rest))) {
					appendTextChunk(res[1]);
					rest = rest.substring(res[0].length);
				} else {
					appendTextChunk(rest[0]);
					rest = rest.substring(1);
				}
			}
			
			return chunks;
		},
		
		/**
		 * Compares two natural chunks of text/numbers, returning -1 if the first is greater (alphanumerically) than 
		 * the other, 0 if they're equal and 1 if greater.
		 * 
		 * @param {Array} chunks1 The first chunks array.
		 * @param {Array} chunks2 The second chunks array.
		 * @return {Integer} -1 if chunks1 less than chunks2, 0 if equal or 1 if greater.
		 */
		compareNaturalChunks: function (chunks1, chunks2) {
			var i = 0, minLen = Math.min(chunks1.length, chunks2.length);
			while (i < minLen) {
				if (chunks1[i] < chunks2[i]) {
					return -1;
				} else if (chunks1[i] > chunks2[i]) {
					return 1;
				}
				i++;
			}
			if (chunks1.length == chunks2.length)
				return 0;
			return (chunks1.length < chunks2.length ? -1 : 1);
		}
		
	};
	
})(window.CbnTable);
