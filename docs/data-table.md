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
- `headStyle` (*String*|*Object*): the CSS to set to column's header cell;
- `style` (*String*|*Object*): the CSS to set to the column's item cells;
- `renderAs` (*String*, default: `text`): the rendering mode of the cells; see the rendering modes section below;
- `template` (*String*): a CSS selector to find the `<template>` to use for `renderAs`;
- `type` (*String*): the data type of this column's values; used for display formatting / filtering / sorting;
- `filter` (*Boolean*|*String*|*Function*): specifies the filtering mode or a function to use for this (see the 
  **Data Filtering** section);
- `sortable` (*Boolean*): set to true to enable sorting for this column;

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

Each table column has a `name` and a data `type` attribute. Those are used to fetch and interpret the appropriate values
from each item / row (which is usually an object). 

For example, the column definition `{ "name": "age", "type": "integer" }` fetches the `age` property of each row and 
uses them as numbers (for filtering and sorting).

The `cbn-data-table` element supports customizable data processing callbacks:

- `column(column)` is called once for each column (when the table is initialized); it is useful for plugins that accept 
   additional configuration variables to store a normalized setting values (with defaults inferred etc.);

- `value(item, column)`

TODO


Data Filtering
--------------

TODO
