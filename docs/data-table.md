Cbn-Data-Table Docs
===================

Usage
-----

In order to use the data table component, you must specify the `items` and `columns` attributes:

- `items` is an array of row objects to be displayed inside the table;
- `columns` is a list of descriptor objects that specify how to represent the table data using columns. 
  Columns should have, at minimum, a `caption` (which specifies the header / title of the column), a `name` (the name 
  of the object property) and a `renderAs` value (which specifies the rendering mode: text, html or template-based). 
  For more details, see the **Columns** section.

Example: 

```html
<cbn-data-table items="{{ data }}" columns='
		{ "name": "firstName", "caption": "First Name" },
		{ "name": "lastName", "caption": "Last Name" },
		{ "name": "email", "caption": "Email", "renderAs": "email", "template": "emailCell" }'>
	<template id="emailCell">
		<a href="[[ computeMailTo(item.email) ]]">[[ item.email ]]</a>
	</template>
</cbn-data-table>
```

Note that the item and row terms are used interchangeably during this document (and also in the element's source code).

Column Descriptor
-----------------

The column object uses the following main / base properties:

- `name` (*String*): an unique name of the column; it is also the name of the item property that contains the cell data;
- `caption` (*String*): the column text to display inside the table's header section;
- `visible` (*Boolean*): whether the column is visible to the user (default: *true*);
- `headStyle` (*String*|*Object*|*Function*): the CSS to set to column's header cell or a callback that returns it;
- `style` (*String*|*Object*|*Function*): the CSS to set to the column's item cells or a callback that returns it;
- `renderAs` (*String*, default: `text`): the rendering mode of the cells; see the rendering modes section below;
- `template` (*String*): a CSS selector to find the `<template>` to use for `renderAs`;
- `type` (*String*): the data type of this column's values; used for display formatting / filtering / sorting;
- `filter` (*Boolean*|*String*|*Function*): specifies the filtering mode or a function to call for doing this (see the 
  **Data Filtering** section);
- `filterElement` (*String*): if you want a custom filter input to be used for this column, specify here the ID of the 
  `<template>` element (uses Polymer Templatizer); see **Data Filtering**;
- `sortable` (*Boolean*): set to false to disable sorting for this column (defaults to true);

Note that the `style` and `headStyle` both accept a callback function instead of CSS text / objects. It will be called 
with the column and item parameters (e.g. `headStyleFunc(column)`, `styleFunc(item, column)`) and should return either 
a String or an object representing the styles to set.

Third party plugins may use additional column properties, make sure to read their documentation.


Rendering Modes
---------------

Available rendering modes:

* `text`: the default value; uses `innerText` to render the cell's contents;
* `html`: like *text*, but allows HTML contents (warning: uses `innerHTML`, which is insecure / can facilitate XSS 
  vulnerabilities);
* `template`: recommended/safe alternative for printing rich cell contents using Polymer Templatizer.

In order to use the `template` mode, you must define a `<template>` element inside the `<cbn-data-table>` element: 
```html
<cbn-data-table ...>
	<template id="myTemplate"><i>[[ item.myValue ]]</i></template>
</cbn-data-table>
```

Then specify a CSS selector for this template inside the column's descriptor object (using the `template` property):
```javascript
{
	"renderAs": "template",
	"template": "#myTemplate"
}
```

Inside the template, you can use the `[[item]]` and `[[index]]` bound properties, plus all your host component's data 
bindings, methods and listeners; e.g.:
```html
<template>
	<paper-button on-tap="tableButtonPressed">
		#<span>[[index]]</span>: <span>[[item.value]]</span>
	</paper-button>
</template>
```


Data Processing Model
---------------------

Each table column has a `name` and a data `type` attribute. Those are used to tell cbn-data-table how to fetch and 
interpret the appropriate values from each item object. 

For example, the column descriptor `{ "name": "age", "type": "integer" }` fetches the `age` property of each row and 
uses them as numbers (for filtering and sorting).

The `cbn-data-table` element supports customizable data processing callbacks based on its `type`.

Available column type callbacks:

- `column(column)` is called once for each column (when the table is initialized); it is useful for plugins that accept 
   additional configuration variables, to store normalized values;
- `value(item, column)` fetches the cell value from the specified item object; by default, it fetches `item[column.name]`;
  the value returned by this function will be passed on all following callbacks;
- `display(val, column)` is responsible for converting the internal cell value to String, for displaying;
- `filter(val, expression, column)`: filters a value using the specified expression (which is, usually, a String); 
  should return true if the filter matches, false otherwise;
- `compare(val1, val2, column)`: comparison function used for sorting; should return `-1` if `val1 < val2`, `1` if 
  `val1 > val2` and `0` when equal;

Additionally, each data type has a `filters` property that can contain named filters (which will be described in 
the **Data Filtering** chapter).

`Cbn-data-table`'s processing steps are:

- *When the `columns` property is changed / the table is initialized: for each column...*
   
   1. The `column` object is processed, defaults are inferred, callback pointers are initialized;
   2. `column(column)` callback is invoked based on the column's `type`.

- *After the `items` are set / changed: *
   
   1. When the item is first displayed / filtered / compared, the `value(item, column)` function called for the column's 
   type. This resulting value is cached (using a WeakMap) and used for all subsequent item operations;
   2. The action is then executed and its appropriate callback invoked (`display` / `filter` / `compare`).

This callback model can be used to implement custom data mechanics for many applications.

For example, the `date` type converts the cell's value to a Moment date object which it uses for filtering and sorting, 
while its `display` callback converts this back to String based on a `column.dateFormat` setting.


### Built-in types

The data table supports the following built-in types:

- `string`: the cell's value is type-casted to String, filtered using ;
- `boolean`: if `item[column.name]` is set and truth-y, the value is true; false otherwise;
- `integer`: parses the cell's value to integer; if the parsing failed, the value is considered to be null / empty.
- `float`: same as above, but accepts also decimals after the radix point;
- `date`: requires and uses the Moment.js library to parse/format dates; it accepts the following `column` object 
   properties: 
   - `column.dateFormat`: the format used to display the values;
   - `column.dateValueFormat`: the format used to parse the raw cell values; if empty, then `dateFormat` is used instead;
- `index`: special type that prints the row index inside the cell;
- `inert`: considers all values as null and disables filtering / sorting; useful for e.g. row action buttons.

Those types usually accept null / undefined values and display an empty string (`''`) instead. 
Also, the filter / compare methods should be able to deal with such item values.

If those built-in types don't suffice, one can easily create new ones, as described in the next sub-section.


### Data type extension mechanism (implementing custom types)

The data types are declared inside the `CbnTable.DataTypes` global object.

In order to implement a new/custom type, you only have to add a new property with its identifier:
```
CbnTable.DataTypes['my-custom-type'] = {
    value: function(item, column) {
       return processMyValue(item[column.name]);
    },
    compare: function(val1, val2, column) {
       return val1.getIndex() - val2.getIndex();
    }
};
```

As in the example above, you can implement any of the callbacks presented in the **Data Processing Model** section.


Data Filtering
--------------

Lastly, the data table component supports an extensible filtering mechanism that can work both with or separated from 
the data type system.

Each filterable column must specify a `filter` property, which can be:

- boolean `false` to disable filtering;
- a string, which specifies a built-in / plugin-provided named filter;
- or a function that is called with the same signature as the `filter(val, expression, column)` type callback, for each 
  value to be filtered.

There are several named filters available which apply for all data types:

- `equals`: exact match using javascript `==`;
- `equals-ci`: the value is converted to string and compared with the filter value in a case-insensitive manner;
- `contains`: checks if the string value contains the filter expression as sub-string;
- `contains-ci`: as above, but case-insensitive.

The filters are declared inside the `CbnTable.DataTypes[type].filters` structure. 
If you want to implement a custom filter, simply add a new property inside the targeted type's `filters` map.
If the filter needs to be available for all data types, simply use the `'_'` key as the type name.

The filter function's signature is `filter(val, expression, column)`, where `val` is the processed item value (using the 
`value` data type callback), `expression` is the user's filter value (usually, a String, but some filter plugins can 
use different conventions) and `column` is the column descriptor object (which can contain custom filter configuration 
properties).

A note about the `filter(...)` data type callback that was presented in  the **Data Processing Model** section: 
the default implementation is the one that does everything what was presented above: checks if a named filter is 
available and calls it. If you override it, you should add your own named filter support (or some other mechanism).
