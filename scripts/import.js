/**
 * TOFLIT18 Import Script
 * =======================
 *
 * Script aiming at importing the project's sources into a neo4j database which
 * will be used by the datascape.
 */
import {argv} from 'yargs';
import {parse as parseCsv, stringify as stringifyCsv} from 'csv';
import {default as h} from 'highland';
import {db as dbConfig, api as apiConfig} from '../config.json';
import {hash} from '../lib/crypto';
import {normalizeYear} from '../lib/republican_calendar';
import {cleanText} from '../lib/clean';
import fs from 'fs';
import _ from 'lodash';

/**
 * Helpers
 * ========
 *
 * Miscellaneous utilities used by the script.
 */

/**
 * Builder class
 */
class Builder {
  constructor() {

    const nodesWriteStream = fs.createWriteStream('./nodes.csv', 'utf-8'),
          edgesWriteStream = fs.createWriteStream('./edges.csv', 'utf-8');

    // Properties
    this.nodesCount = 0;
    this.nodesStream = h();
    this.edgesStream = h();

    // Piping
    this.nodesStream
      .pipe(stringifyCsv({delimiter: ','}))
      .pipe(nodesWriteStream);

    this.edgesStream
      .pipe(stringifyCsv({delimiter: ','}))
      .pipe(edgesWriteStream);

    // Writing headers
    this.nodesStream.write(NODE_PROPERTIES_TYPES.concat(':LABEL', ':ID'));
    this.edgesStream.write([':START_ID', ':END_ID', ':TYPE', 'ligne:int', 'sheet:int']);
  }

  save(data, label) {
    const row = _({})
      .merge(_.mapValues(NODE_PROPERTIES_MAPPING, x => ''))
      .merge(data)
      .pairs()
      .sortBy(e => NODE_PROPERTIES_MAPPING[e[0]])
      .map(e => e[1])
      .concat([label, this.nodesCount])
      .value();

    this.nodesStream.write(row);

    return this.nodesCount++;
  }

  relate(source, predicate, target, data) {
    const row = [source, target, predicate];

    if (data)
      row.push(data.ligne || '', data.sheet || '');

    this.edgesStream.write(row);
  }
}

/**
 * Index creation function
 */
function indexedNode(index, label, key, data) {
  let node = index[key];
  if (!node) {
    node = BUILDER.save(data, label);
    index[key] = node;
  }

  return node;
}


/**
 * Initialization
 * ===============
 *
 * Defining path constants, reading the CLI arguments etc.
 */

/**
 * Paths
 */
const BDD_CENTRALE_PATH = '/base_centrale/bdd_centrale.csv',
      CLASSIFICATIONS_PATH = '/Traitement des marchandises, pays, unités',
      ORTHOGRAPHIC_CLASSIFICATION = CLASSIFICATIONS_PATH + '/bdd_marchandises_normalisees_orthographique.csv',
      SIMPLIFICATION = CLASSIFICATIONS_PATH + '/bdd_marchandises_simplifiees.csv',
      OTHER_CLASSIFICATIONS = CLASSIFICATIONS_PATH + '/bdd_marchandises_classifiees.csv',
      COUNTRY_CLASSIFICATIONS = CLASSIFICATIONS_PATH + '/bdd_pays.csv';

/**
 * Constants
 */

// Possible properties
const POSSIBLE_NODE_PROPERTIES = [
  'no:int',
  'quantity',
  'value',
  'unit_price',
  'normalized_year:int',
  'year',
  'import:boolean',
  'sheet',
  'name',
  'path',
  'type',
  'model',
  'note',
  'slug',
  'password',
  'description',
  'padding'
];

const NODE_PROPERTIES_MAPPING = _(POSSIBLE_NODE_PROPERTIES)
  .map((p, i) => [p.split(':')[0], i])
  .zipObject()
  .value();

const NODE_PROPERTIES_TYPES = POSSIBLE_NODE_PROPERTIES;

/**
 * Reading arguments
 */
const DATA_PATH = argv.path || argv.p;

if (!DATA_PATH)
  throw Error('No data path provided.');

console.log('Reading csv files from "' + DATA_PATH + '"');
console.log('Processing flows...');

/**
 * Basic instantiation
 */

// Creating the builder
const BUILDER = new Builder();

// Creating the TOFLIT18 user
const TOFLIT18_USER = BUILDER.save({
  name: 'toflit18',
  password: hash(apiConfig.secret)
}, 'User');

// Indexes
const INDEXES = {
  directions: {},
  countries: {},
  offices: {},
  operators: {},
  origins: {},
  products: {},
  sources: {},
  units: {}
};

const EDGE_INDEXES = {
  offices: new Set()
};

const CLASSIFICATION_NODES = {
  product_orthographic: BUILDER.save({
    name: 'Orthographic Normalization',
    model: 'Product',
    slug: 'orthographic_normalization',
    description: 'Fixing the source\'s somewhat faulty orthograph.',
    padding: 'limbo'
  }, 'Classification'),
  product_simplified: BUILDER.save({
    name: 'Simplification',
    model: 'Product',
    slug: 'simplification',
    description: 'Simplifying the source.',
    padding: 'limbo'
  }, 'Classification'),
  product_categorized: BUILDER.save({
    name: 'Categorization',
    model: 'Product',
    slug: 'categorization',
    description: 'Categorizing the various products.',
    padding: 'limbo'
  }, 'Classification'),
  product_sitcrev1: BUILDER.save({
    name: 'SITC Rev.1',
    model: 'Product',
    slug: 'sitc_rev1',
    description: 'SITC Rev.1',
    padding: 'limbo'
  }, 'Classification'),
  product_sitcrev2: BUILDER.save({
    name: 'SITC Rev.2',
    model: 'Product',
    slug: 'sitc_rev2',
    description: 'SITC Rev.2',
    padding: 'limbo'
  }, 'Classification'),
  product_medicinal: BUILDER.save({
    name: 'Medicinal products',
    model: 'Product',
    slug: 'medicinal_products',
    description: 'Gathering some medicinal products.',
    padding: 'limbo'
  }, 'Classification'),
  country_orthographic: BUILDER.save({
    name: 'Orthographic Normalization',
    model: 'Country',
    slug: 'orthographic_normalization',
    description: 'Fixing the source\'s somewhat faulty orthograph.',
    padding: 'limbo'
  }, 'Classification'),
  country_simplified: BUILDER.save({
    name: 'Simplification',
    model: 'Country',
    slug: 'simplification',
    description: 'Simplifying the source.',
    padding: 'limbo'
  }, 'Classification'),
  country_grouped: BUILDER.save({
    name: 'Grouping',
    model: 'Country',
    slug: 'grouping',
    description: 'Grouping the countries for convenience.',
    padding: 'limbo'
  }, 'Classification')
};

const CLASSIFICATION_INDEXES = {};

Object.keys(CLASSIFICATION_NODES).forEach(k => {
  BUILDER.relate(CLASSIFICATION_NODES[k], 'CREATED_BY', TOFLIT18_USER);
  CLASSIFICATION_INDEXES[k] = {};
});

/**
 * Process
 * ========
 *
 * Reading the multiple CSV file and parsing them accordingly in order to create
 * the graph.
 */

/**
 * Parsing the file
 */
let readStream = fs.createReadStream(DATA_PATH + BDD_CENTRALE_PATH)
  .pipe(parseCsv({delimiter: ',', columns: true}));

// Getting the flows
readStream = h(readStream)
  // .drop(5000)
  // .take(1000)
  .map(l => _.mapValues(l, cleanText))
  .each(importer)
  .on('end', function() {

    console.log('Processing classifications...');

    console.log('  -- Products orthographic normalization');

    // Parsing orthographic corrections for products
    const opcsvData = fs.readFileSync(DATA_PATH + ORTHOGRAPHIC_CLASSIFICATION, 'utf-8');
    parseCsv(opcsvData, {delimiter: ','}, function(err, data) {
      data
        .slice(1)
        .map(line => ({
          original: cleanText(line[0]),
          modified: cleanText(line[1]),
          note: cleanText(line[2])
        }))
        .forEach(orthographicProduct);

        console.log('  -- Products simplification');

        // Parsing raw simplification
        const spcsvData = fs.readFileSync(DATA_PATH + SIMPLIFICATION, 'utf-8');
        parseCsv(spcsvData, {delimiter: ','}, function(err, data) {
          data
            .slice(1)
            .map(line => ({
              orthographic: cleanText(line[0]),
              simplified: cleanText(line[1])
            }))
            .forEach(simplifiedProduct);

            console.log('  -- Products various classifications');

            // Parsing various classifications
            const vpcsvData = fs.readFileSync(DATA_PATH + OTHER_CLASSIFICATIONS, 'utf-8');
            parseCsv(vpcsvData, {delimiter: ','}, function(err, data) {
              _(data.slice(1))
                .map(line => ({
                  simplified: cleanText(line[0]),
                  categorized: cleanText(line[1]),
                  sitcrev1: cleanText(line[2]),
                  sitcrev2: cleanText(line[3])
                }))
                .forEach(categorizedProduct)
                .forEach(sitcrev2Product)
                .uniq('sitcrev2')
                .forEach(sitcrev1Product)
                .value();
            });
        });
    });

    console.log('  -- Countries various classifications');

    // Parsing various classifications for countries
    const occsvData = fs.readFileSync(DATA_PATH + COUNTRY_CLASSIFICATIONS, 'utf-8');
    parseCsv(occsvData, {delimiter: ','}, function(err, data) {
      _(data.slice(1))
        .map(line => ({
          original: cleanText(line[0]),
          orthographic: cleanText(line[1]),
          simplified: cleanText(line[2]),
          grouped: cleanText(line[3])
        }))
        .forEach(orthographicCountry)
        .uniq('orthographic')
        .forEach(simplifiedCountry)
        .uniq('simplified')
        .forEach(groupedCountry)
        .value();
    });
  });

/**
 * Consuming the flows.
 */
function importer(csvLine) {

  // Direction
  const isImport = /(imp|sortie)/i.test(csvLine.exportsimports);

  // Creating a flow node
  const nodeData = {
    quantity: csvLine.quantit,
    value: +csvLine.value,
    unit_price: csvLine.prix_unitaire,
    year: csvLine.year,
    normalized_year: normalizeYear(csvLine.year),
    import: '' + isImport,
  };

  if (csvLine.remarks)
    nodeData.note = csvLine.remarks;

  const flowNode = BUILDER.save(nodeData, 'Flow');

  // Operator
  if (csvLine.dataentryby) {
    const operatorNode = indexedNode(INDEXES.operators, 'Operator', csvLine.dataentryby, {
      name: csvLine.dataentryby
    });

    BUILDER.relate(flowNode, 'TRANSCRIBED_BY', operatorNode);
  }

  // Source
  if (csvLine.source) {
    const sourceNode = indexedNode(INDEXES.sources, 'Source', csvLine.source, {
      name: csvLine.source,
      path: csvLine.sourcepath,
      type: csvLine.sourcetype
    });

    BUILDER.relate(flowNode, 'TRANSCRIBED_FROM', sourceNode, {
      line: +csvLine.numrodeligne,
      sheet: +csvLine.sheet
    });
  }

  // Product
  if (csvLine.marchandises || csvLine.marchandises === '') {
    const productNode = indexedNode(INDEXES.products, 'Product', csvLine.marchandises, {
      name: csvLine.marchandises
    });

    BUILDER.relate(flowNode, 'OF', productNode);
  }

  // Origin
  if (csvLine.origine) {
    const originNode = indexedNode(INDEXES.origins, 'Origin', csvLine.origine, {
      name: csvLine.origine
    });

    BUILDER.relate(originNode, 'ORIGINATES_FROM', flowNode);
  }

  // Office
  if (csvLine.bureaux) {
    const officeNode = indexedNode(INDEXES.offices, 'Office', csvLine.bureaux, {
      name: csvLine.bureaux
    });

    if (isImport)
      BUILDER.relate(flowNode, 'FROM', officeNode);
    else
      BUILDER.relate(flowNode, 'TO', officeNode);

    if (csvLine.direction && !EDGE_INDEXES.offices.has(csvLine.bureaux)) {
      const directionNode = indexedNode(INDEXES.directions, 'Direction', csvLine.direction, {
        name: csvLine.direction
      });

      BUILDER.relate(directionNode, 'GATHERS', officeNode);
      EDGE_INDEXES.offices.add(csvLine.bureaux);
    }
  }

  // Direction
  if (csvLine.direction && !csvLine.bureaux) {
    const directionNode = indexedNode(INDEXES.directions, 'Direction', csvLine.direction, {
      name: csvLine.direction
    });

    if (isImport)
      BUILDER.relate(flowNode, 'FROM', directionNode);
    else
      BUILDER.relate(flowNode, 'TO', directionNode);
  }

  // Country
  if (csvLine.pays) {
    const countryNode = indexedNode(INDEXES.countries, 'Country', csvLine.pays, {
      name: csvLine.pays
    });

    if (!isImport)
      BUILDER.relate(flowNode, 'FROM', countryNode);
    else
      BUILDER.relate(flowNode, 'TO', countryNode);
  }

  // Units
  if (csvLine.quantity_unit) {
    const productNode = indexedNode(INDEXES.units, 'Unit', csvLine.quantity_unit, {
      name: csvLine.quantity_unit
    });

    BUILDER.relate(flowNode, 'VALUE_IN', productNode);
  }

  // TODO: normalize unit_price
}

/**
 * Consuming the classifications.
 */
function orthographicProduct(line) {
  const alreadyLinked = !!CLASSIFICATION_INDEXES.product_orthographic[line.modified];

  const nodeData = {
    name: line.modified
  };

  if (line.note)
    nodeData.note = line.note;

  const classifiedNode = indexedNode(
    CLASSIFICATION_INDEXES.product_orthographic,
    'ClassifiedProduct',
    line.modified,
    nodeData
  );

  const targetNode = INDEXES.products[line.original];

  if (!alreadyLinked)
    BUILDER.relate(CLASSIFICATION_NODES.product_orthographic, 'HAS', classifiedNode);

  if (targetNode !== undefined)
    BUILDER.relate(classifiedNode, 'AGGREGATES', targetNode);
}

function simplifiedProduct(line) {
  const alreadyLinked = !!CLASSIFICATION_INDEXES.product_simplified[line.simplified];

  const nodeData = {
    name: line.simplified
  };

  const classifiedNode = indexedNode(
    CLASSIFICATION_INDEXES.product_simplified,
    'ClassifiedProduct',
    line.simplified,
    nodeData
  );

  const targetNode = CLASSIFICATION_INDEXES.product_orthographic[line.orthographic];

  if (!alreadyLinked)
    BUILDER.relate(CLASSIFICATION_NODES.product_simplified, 'HAS', classifiedNode);

  if (targetNode !== undefined)
    BUILDER.relate(classifiedNode, 'AGGREGATES', targetNode);
}

function categorizedProduct(line) {
  if (!line.categorized)
    return;

  const alreadyLinked = !!CLASSIFICATION_INDEXES.product_categorized[line.categorized];

  const nodeData = {
    name: line.categorized
  };

  const classifiedNode = indexedNode(
    CLASSIFICATION_INDEXES.product_categorized,
    'ClassifiedProduct',
    line.categorized,
    nodeData
  );

  const targetNode = CLASSIFICATION_INDEXES.product_simplified[line.simplified];

  if (!alreadyLinked)
    BUILDER.relate(CLASSIFICATION_NODES.product_categorized, 'HAS', classifiedNode);

  if (targetNode !== undefined)
    BUILDER.relate(classifiedNode, 'AGGREGATES', targetNode);
}

function sitcrev2Product(line) {
  if (!line.sitcrev2)
    return;

  const alreadyLinked = !!CLASSIFICATION_INDEXES.product_sitcrev2[line.sitcrev2];

  const nodeData = {
    name: line.sitcrev2
  };

  const classifiedNode = indexedNode(
    CLASSIFICATION_INDEXES.product_sitcrev2,
    'ClassifiedProduct',
    line.sitcrev2,
    nodeData
  );

  const targetNode = CLASSIFICATION_INDEXES.product_simplified[line.simplified];

  if (!alreadyLinked)
    BUILDER.relate(CLASSIFICATION_NODES.product_sitcrev2, 'HAS', classifiedNode);

  if (targetNode !== undefined)
    BUILDER.relate(classifiedNode, 'AGGREGATES', targetNode);
}

function sitcrev1Product(line) {
  if (!line.sitcrev1)
    return;

  const alreadyLinked = !!CLASSIFICATION_INDEXES.product_sitcrev1[line.sitcrev1];

  const nodeData = {
    name: line.sitcrev1
  };

  const classifiedNode = indexedNode(
    CLASSIFICATION_INDEXES.product_sitcrev1,
    'ClassifiedProduct',
    line.sitcrev1,
    nodeData
  );

  const targetNode = CLASSIFICATION_INDEXES.product_sitcrev2[line.sitcrev2];

  if (!alreadyLinked)
    BUILDER.relate(CLASSIFICATION_NODES.product_sitcrev1, 'HAS', classifiedNode);

  if (targetNode !== undefined)
    BUILDER.relate(classifiedNode, 'AGGREGATES', targetNode);
}

function orthographicCountry(line) {
  if (!line.orthographic)
    return;

  const alreadyLinked = !!CLASSIFICATION_INDEXES.country_orthographic[line.orthographic];

  const nodeData = {
    name: line.orthographic
  };

  const classifiedNode = indexedNode(
    CLASSIFICATION_INDEXES.country_orthographic,
    'ClassifiedCountry',
    line.orthographic,
    nodeData
  );

  const targetNode = INDEXES.countries[line.original];

  if (!alreadyLinked)
    BUILDER.relate(CLASSIFICATION_NODES.country_orthographic, 'HAS', classifiedNode);

  if (targetNode !== undefined)
    BUILDER.relate(classifiedNode, 'AGGREGATES', targetNode);
}

function simplifiedCountry(line) {
  if (!line.simplified)
    return;

  const alreadyLinked = !!CLASSIFICATION_INDEXES.country_simplified[line.simplified];

  const nodeData = {
    name: line.simplified
  };

  const classifiedNode = indexedNode(
    CLASSIFICATION_INDEXES.country_simplified,
    'ClassifiedCountry',
    line.simplified,
    nodeData
  );

  const targetNode = CLASSIFICATION_INDEXES.country_orthographic[line.orthographic];

  if (!alreadyLinked)
    BUILDER.relate(CLASSIFICATION_NODES.country_simplified, 'HAS', classifiedNode);

  if (targetNode !== undefined)
    BUILDER.relate(classifiedNode, 'AGGREGATES', targetNode);
}

function groupedCountry(line) {
  if (!line.grouped)
    return;

  const alreadyLinked = !!CLASSIFICATION_INDEXES.country_grouped[line.grouped];

  const nodeData = {
    name: line.grouped
  };

  const classifiedNode = indexedNode(
    CLASSIFICATION_INDEXES.country_grouped,
    'ClassifiedCountry',
    line.grouped,
    nodeData
  );

  const targetNode = CLASSIFICATION_INDEXES.country_simplified[line.simplified];

  if (!alreadyLinked)
    BUILDER.relate(CLASSIFICATION_NODES.country_grouped, 'HAS', classifiedNode);

  if (targetNode !== undefined)
    BUILDER.relate(classifiedNode, 'AGGREGATES', targetNode);
}
