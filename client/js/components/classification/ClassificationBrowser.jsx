/**
 * TOFLIT18 Client Classification Browser
 * =======================================
 *
 * Displaying the existing classifications in order to let the user
 * choose one and edit it, or even create a new one `in medias res`.
 */
import React, {Component} from 'react';
import {branch} from 'baobab-react/decorators';
import {Row, Col} from '../misc/Grid.jsx';
import Button, {ButtonGroup} from '../misc/Button.jsx';
import {Spinner, Waiter} from '../misc/Loaders.jsx';
import Infinite from '../misc/Infinite.jsx';
import {prettyPrint} from '../../lib/helpers';
import cls from 'classnames';

// Actions
import {
  download,
  expand,
  modal,
  search,
  select
} from '../../actions/browser';
import {linker} from '../../actions/factory';

/**
 * Main component.
 */
@branch({
  actions: {
    expand,
    download,
    modal
  },
  cursors: {
    downloading: ['flags', 'downloading'],
    loading: ['states', 'classification', 'browser', 'loading'],
    current: ['states', 'classification', 'browser', 'current'],
    classifications: ['data', 'classifications', 'flat']
  }
})
export default class ClassificationBrowser extends Component {
  render() {
    let {
      actions,
      classifications,
      current,
      downloading
    } = this.props;

    current = current || {};

    return (
      <div className="browser-wrapper">
        <Row className="full-height">
          <LeftPanel {...this.props} />
          <RightPanel {...this.props} />
        </Row>
      </div>
    );
  }
}

/**
 * Left panel.
 */
class LeftPanel extends Component {
  render() {
    let {
      actions,
      current,
      classifications: {product, country},
      downloading
    } = this.props;

    current = current || {};

    const list = (
      <div className="full-height">
        <h4 className="classifications-category">Products</h4>
        <ClassificationsList items={product}
                             selected={current.id} />
        <h4 className="classifications-category">Countries</h4>
        <ClassificationsList items={country}
                             selected={current.id} />
      </div>
    );

    return (
      <Col md={5} className="full-height">
        <div className="panel full-height">
          <h3>Classifications</h3>
          <hr />
          <div className="partial-height twice overflow">
            {(!product || !product.length) ? <Waiter /> : list}
          </div>
          <hr />
          <div className="actions">
            <Col md={3}>
              <Button kind="primary"
                      onClick={() => actions.download(current.id)}
                      disabled={current.source || false}
                      loading={downloading}>
                Export
              </Button>
            </Col>
            <Col md={9} style={{textAlign: 'right'}}>
              <ButtonGroup>
                <Button kind="secondary"
                        disabled={true}
                        onClick={() => actions.modal('create')}>
                  Create From
                </Button>
                <Button kind="secondary"
                        disabled={current.source || false}
                        onClick={() => actions.modal('update')}>
                  Update
                </Button>
              </ButtonGroup>
            </Col>
          </div>
        </div>
      </Col>
    );
  }
}

/**
 * Right panel
 */
class RightPanel extends Component {
  render() {
    let {actions, current, loading} = this.props;

    current = current || {};

    let list = loading ?
      <Waiter /> :
      (
        <Infinite className="partial-height twice overflow"
                  action={() => actions.expand(current)}
                  tracker={current.id}>
          <GroupsList source={current.source} />
        </Infinite>
      );

    return (
      <Col md={7} className="full-height">
        <div className="panel full-height">
          <h4>{current.name || '...'}</h4>
          <hr />
          <GroupQuery id={current.id} loading={loading} />
          <hr />
          {list}
        </div>
      </Col>
    );
  }
}

/**
 * Classification list.
 */
function ClassificationsList({items, selected}) {
  return (
    <ul className="classifications-list">
      {items.map((data, i) =>
        <Classification key={data.id}
                        data={data}
                        active={selected === data.id} />)}
    </ul>
  );
}

/**
 * Classification.
 */
@branch({
  actions: {
    select
  }
})
class Classification extends Component {
  render() {
    const {
      actions,
      active,
      data: {
        id,
        name,
        author,
        level,
        groupsCount,
        itemsCount,
        unclassifiedItemsCount,
        completion,
        source
      }
    } = this.props;

    const offset = (level * 25) + 'px';

    const itemsNotice = (itemsCount || null) && [
      ' for ',
      <em key="groups">{prettyPrint(itemsCount)}</em>,
      ' items'
    ];

    const missingCount = (unclassifiedItemsCount || null) && (
      <span>
        &nbsp;(<em className="red">-{prettyPrint(unclassifiedItemsCount)}</em>)
      </span>
    );

    const completionNotice = !source && (
      <div className="addendum">
        <em>{prettyPrint(itemsCount - unclassifiedItemsCount)}</em> /
        &nbsp;<em className="green">{prettyPrint(itemsCount)}</em>
        {missingCount}
        &nbsp;classified items
        &nbsp;<em>({completion} %)</em>
      </div>
    );

    return (
      <li className={cls('item', {active})}
          style={{marginLeft: offset}}
          onClick={e => !active && actions.select(id)}>
        <div>
          <strong>{name}</strong> (<em>{author}</em>)
        </div>
        <div className="addendum">
          <em>{prettyPrint(groupsCount)}</em> groups{itemsNotice}.
        </div>
        {completionNotice}
      </li>
    );
  }
}

/**
 * Group query.
 */
const QUERY_PATH = ['states', 'classification', 'browser', 'query'];

@branch({
  cursors: {
    query: QUERY_PATH
  },
  actions: {
    update: linker(QUERY_PATH),
    search
  }
})
class GroupQuery extends Component {
  submit() {
    const query = this.props.query;

    if (query)
      return this.props.actions.search(this.props.id, query);
  }

  render() {
    const {
      actions,
      id,
      loading,
      query
    } = this.props;

    return (
      <div className="input-group">
        <input type="text"
               className="form-control"
               placeholder="Query..."
               value={query}
               onKeyPress={(e) => e.which === 13 && this.submit()}
               onChange={e => actions.update(e.target.value)} />
        <span className="input-group-btn">
          <Button kind="secondary"
                  loading={loading}
                  onClick={() => this.submit()}>
            Filter
          </Button>
        </span>
      </div>
    );
  }
}

/**
 * Groups list.
 */
@branch({
  cursors: {
    groups: ['states', 'classification', 'browser', 'rows']
  }
})
class GroupsList extends Component {
  render() {
    const {groups, source} = this.props;

    return (
      <ul className="entities-list">
        {groups.length ?
          groups.map(g => <Group source={source} key={g.id} {...g} />) :
          <span>No Results...</span>}
      </ul>
    );
  }
}

/**
 * Group.
 */
const MAX_NUMBER_OF_DISPLAYED_ITEMS = 5;

class Group extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {opened: false};
  }

  toggle() {
    this.setState({opened: !this.state.opened});
  }

  render() {
    const {name, items, source} = this.props,
          opened = this.state.opened,
          count = items.length;

    let addendum;

    // Addendum if there are items in the group
    if (count) {

      // Potential ellipsis
      const ellipsis = (
        <span className="ellipsis"
              title="Click to expand"
              onClick={() => this.toggle()}>[...]</span>
      );

      const itemsToDisplay = !opened ?
        items.slice(0, MAX_NUMBER_OF_DISPLAYED_ITEMS) :
        items;

      addendum = (
        <ul className="addendum">
          {itemsToDisplay.map((item, i) => (<Item key={i} name={item} />))}
          {(!opened && items.length > MAX_NUMBER_OF_DISPLAYED_ITEMS) && ellipsis}
        </ul>
      );
    }

    return (
      <li className="item">
        <div>
          {name} {!source && <em>({count} items)</em>}
        </div>
        {addendum}
      </li>
    );
  }
}

/**
 * Item.
 */
function Item({name}) {
  return (
    <li>
      <em>{name}</em>
    </li>
  );
}