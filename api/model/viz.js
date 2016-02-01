/**
 * TOFLIT18 Viz Model
 * ===================
 *
 */
import decypher from 'decypher';
import database from '../connection';
import {tokenizeTerms} from '../../lib/tokenizer';
import config from '../../config.json';
import {viz as queries} from '../queries';
import _, {values} from 'lodash';

const {Query} = decypher;

const Model = {

  /**
   * Flows per year per data type.
   */
  flowsPerYearPerDataType(dataType, callback) {

    const query = new Query();
    if (dataType === 'direction' || dataType === 'sourceType') {

      //direction or sourceType requested
      query.match('(f:Flow)');
      query.where(`has(f.${dataType}) AND f.year >= ${config.api.limits.minYear}`);
      query.return(`f.${dataType} AS dataType, f.year AS year,count(f) AS flows`);
      query.orderBy(`f.year,dataType`);
    }
    else {
      // a classification
      const [
        ,
        classificationType,
        classificationId
      ] = dataType.match(/(\w+)_(\d+)/) || [];

      if (classificationType) {
        query.start(`n=node(${classificationId})`);
        query.match(`(n)-[:HAS]->(gc)-[:AGGREGATES*0..]->(c:${_.capitalize(classificationType)})`);
        query.with('gc.name AS name, c.name AS sc');
        query.match('(f:Flow)');
        query.where(`f.${classificationType} = sc  AND f.year >= ${config.api.limits.minYear}`);
        query.return('name AS dataType,count(f) AS flows,f.year AS year');
        query.orderBy(`f.year,dataType`);

      }
      else {
        throw new Error('wrong parameter');
      }
    }

    database.cypher(query.build(), function(err, result) {
      if (err) return callback(err);

      const data = _(result)
        .groupBy('dataType')
        .mapValues((values, key) => {
          return {
            name: key,
            data: values.map(e => _.pick(e, ['year', 'flows']))
          };
        })
        .values();

      return callback(null, data);
    });
  },

  /**
   * Available data per year.
   */
  availableDataTypePerYear(dataType, callback) {

    const query = new Query();
    if (dataType === 'direction' || dataType === 'sourceType') {
      //direction or sourceType requested
      query.match('(f:Flow)');
      query.where(`has(f.${dataType})  AND f.year >= ${config.api.limits.minYear}`);
      query.with(`size(collect(DISTINCT f.${dataType})) AS data, f.year AS year`);
      query.return('year, data');
      query.orderBy('year');
    }
    else {
      // a classification
      const [
        ,
        classificationType,
        classificationId
      ] = dataType.match(/(\w+)_(\d+)/) || [];

      if (classificationType) {
        query.start(`n=node(${classificationId})`);
        query.match(`(n)-[:HAS]->(gc)-[:AGGREGATES*0..]->(c:${_.capitalize(classificationType)})`);
        query.with('gc.name AS name, c.name AS sc');
        query.match('(f:Flow)');
        query.where(`f.${classificationType} = sc  AND f.year >= ${config.api.limits.minYear}`);
        query.with(`size(collect(DISTINCT name)) AS data, f.year AS year`);
        query.return('year, data');
        query.orderBy('year');
      }
      else {
        throw new Error('wrong parameter');
      }
    }

    database.cypher(query.build(), function(err, result) {
      if (err) return callback(err);
      return callback(null, result);
    });
  },

  /**
   * Line creation.
   */
  createLine(params, callback) {
    const {
      sourceType,
      direction,
      kind,
      productClassification,
      product,
      countryClassification,
      country
    } = params;

    // Building the query
    const query = new Query(),
          init = query.segment(),
          withs = [],
          starts = [];

    // TODO: refactor and move to decypher?
    const Where = function() {
      this.string = '';

      this.and = function(clause) {
        if (this.string)
          this.string += ' AND ';
        this.string += clause;
      };
    };

    const where = new Where();

    //-- Do we need to match a product?
    if (productClassification) {
      starts.push('pc=node({productClassification})');
      query.match('(pc)-[:HAS]->(pg)-[:AGGREGATES*1..]->(pi)');

      if (product)
        query.where('id(pg) = {product}', {product});

      withs.push('pi');
      query.with('pi');
    }

    //-- Do we need to match a country?
    if (countryClassification) {
      starts.push('cc=node({countryClassification})');
      query.match('(cc)-[:HAS]->(cg)-[:AGGREGATES*1..]->(ci)');

      if (country)
        query.where('id(cg) = {country}', {country});

      query.with(withs.concat('ci').join(', '));
    }

    if (starts.length)
      init.start(starts, {productClassification, countryClassification});

    //-- Basic match
    query.match('(f:Flow)');

    //-- Should we match a precise direction?
    if (direction && direction !== '$all$') {
      query.match('(d:Direction)');
      where.and('id(d) = {direction}');
      where.and('f.direction = d.name');
      query.params({direction});
    }

    //-- Import/Export
    if (kind === 'import')
      where.and('f.import');
    else if (kind === 'export')
      where.and('not(f.import)');

    if (sourceType)
      where.and(`f.sourceType = "${sourceType}"`);
    if (productClassification)
      where.and('f.product = pi.name');
    if (countryClassification)
      where.and('f.country = ci.name');


    if (where.string)
      query.where(where.string);

    //-- Returning data
    query.return('count(f) AS count, sum(f.value) AS value, f.year AS year');
    query.orderBy('f.year');

    database.cypher(query.build(), function(err, data) {
      if (err) return callback(err);

      return callback(null, data);
    });
  },

  /**
   * Building the (directions)--(country) network.
   */
  network(classification, callback) {
    database.cypher({query: queries.network, params: {classification}}, callback);
  },

  /**
   * Retrieve the network of terms for the given classification.
   */
  terms(classification, callback) {
    database.cypher({query: queries.terms, params: {classification}}, function(err, rows) {
      if (err) return callback(err);
      if (!rows.length) return callback(null, null);

      const graph = {
        nodes: {},
        edges: {}
      };

      let edgeId = 0;

      rows.forEach(row => {
        const terms = tokenizeTerms(row.term);

        terms.forEach((term, i) => {

          // Creating the node if it does not exist yet
          if (!graph.nodes[term]) {
            graph.nodes[term] = {
              id: term,
              label: term,
              occurrences: 1,
              positions: [i]
            };
          }
          else {
            graph.nodes[term].occurrences++;
            graph.nodes[term].positions.push(i);
          }

          const node = graph.nodes[term];

          // Retrieving last node
          if (!!i) {
            const lastNode = graph.nodes[terms[i - 1]],
                  hash = `~${lastNode.id}~->~${node.id}~`,
                  reverseHash = `~${node.id}~->~${lastNode.id}~`;

            // Creating a relationship or weighting it once more
            const edge = graph.edges[hash] || graph.edges[reverseHash];

            if (!edge) {
              graph.edges[hash] = {
                id: edgeId++,
                weight: 1,
                source: lastNode.id,
                target: node.id
              };
            }
            else {
              edge.weight++;
            }
          }
        });
      });

      return callback(null, {
        nodes: values(graph.nodes),
        edges: values(graph.edges)
      });
    });
  }
};

export default Model;
