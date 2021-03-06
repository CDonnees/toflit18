/**
 * TOFLIT18 Indicators Actions
 * ============================
 *
 * Actions related to the indicators' view.
 */
import specs from '../../specs.json';
import _, {forIn} from 'lodash';

const ROOT = ['states', 'exploration', 'metadata'];

/**
 * Updating a selector.
 */
function fetchGroups(tree, cursor, id) {
  tree.client.groups({params: {id}}, function(err, data) {
    if (err) return;

    cursor.set(data.result);
  });
}

/**
 * Selecting a data type.
 */
export function select(tree, selected) {
  const cursor = tree.select(ROOT),
        selectors = tree.select([...ROOT, 'selectors']),
        groups = tree.select([...ROOT, 'groups']);

  if (selected && selected.value !== 'direction' && selected.value !== 'sourceType') {
    // const classification = tree.get('data', 'classifications', 'index', selected.id);

    if (selected.model === 'country') {
      selectors.set('countryClassification', null);
      selectors.set('country', null);
      groups.set('country', []);

      if (selected)
        fetchGroups(tree, groups.select('country'), selected.id);
    }
    else {
      selectors.set('productClassification', null);
      selectors.set('product', null);
      groups.set('product', []);

      if (selected)
        fetchGroups(tree, groups.select('product'), selected.id);
    }
  }

  cursor.set('perYear', null);
  cursor.set('flowsPerYear', null);
  cursor.set('dataType', selected);
}

export function updateSelector(tree, name, item) {
  const selectors = tree.select([...ROOT, 'selectors']),
        groups = tree.select([...ROOT, 'groups']);

  // Updating the correct selector
  selectors.set(name, item);

  // If we updated a classification, we need to reset some things
  if (/classification/i.test(name)) {
    const model = name.match(/(.*?)Classification/)[1];

    selectors.set(model, null);
    groups.set(model, []);

    if (item)
      fetchGroups(tree, groups.select(model), item.id);
  }
}

export function addChart(tree) {
  const cursor = tree.select(ROOT);

  cursor.set('perYear', null);
  cursor.set('flowsPerYear', null);
  cursor.set('fileName', null);
  cursor.set('loading', true);

  const selected = cursor.get('dataType');

  if (!selected) {
    return;
  }

  // Loading data from server
  const type = selected.id ?
    `${selected.model}_${selected.id}` :
    selected.value;

  // set params for request
  const params = {},
        paramsRequest = {};

  // get selectors choosen
  forIn(cursor.get('selectors'), (v, k) => {
    if (v) {
      params[k] = v;
    }
  });

  // keep only params !== null for request
  forIn(params, (v, k) => {
    if (k === 'sourceType')
      paramsRequest[k] = v.value;
    else
      paramsRequest[k] = v.id;
  });

  tree.client.flowsPerYear({params: {type}, data: paramsRequest}, function(err, data) {
    cursor.set('loading', false);

    if (err)
      return;

    // Aggregation per year
    const perYear = [];

    _(data.result)
      .map(e => e.data)
      .flatten()
      .map(d => d.year)
      .groupBy()
      .forEach((v, k) => perYear.push({year: +k, data: _.isArray(v) ? v.length : 0}));

    cursor.set('perYear', perYear);

    // Don't ask for data we don't need
    if (selected.id && data.result.length > specs.metadataGroupMax)
      return;

    cursor.set('flowsPerYear', data.result);
  });

  // set fileName form params selected
  let fileName = '';

  forIn(params, (v) => {
    if (v)
      fileName = fileName + v.name + ' - ';
  });

  cursor.set('fileName', fileName);
}
