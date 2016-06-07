/**
 * TOFLIT18 Client NavBar Component
 * =================================
 *
 */
import React, {Component} from 'react';
import {branch} from 'baobab-react/decorators';
import {Link} from 'react-router';
import cls from 'classnames';
import {logout} from '../actions/session';

const LINKS = [
  {
    label: 'MetaData',
    url: '/exploration/meta'
  },
  {
    label: 'Indicators',
    url: '/exploration/indicators'
  },
  {
    label: 'Countries Network',
    url: '/exploration/globals'
  },
  {
    label: 'Product Terms',
    url: '/exploration/globalsterms'
  },
  {
    label: 'Classification',
    url: '/classification/browser'
  }
];

@branch({
  actions: {logout},
  cursors: {
    logged: ['flags', 'logged']
  }
})
export default class NavBar extends Component {
  static contextTypes = {
    router: React.PropTypes.object
  };

  render() {
    const router = this.context.router,
          logged = this.props.logged;

    if (!logged)
      return null;

    const logoutButton = (
      <li className="nav-item pull-right">
        <a className="nav-link logout"
           onClick={() => this.props.actions.logout()}>
          Logout
        </a>
      </li>
    );

    return (
      <div>
        <div className="navbar-emphasis" />
        <nav className="navbar navbar-light bg-faded">
          <div className="container">
            <a className="navbar-brand" href="#">TOFLIT18</a>
            <ul className="nav navbar-nav">
              {LINKS.map(l => (
                <li className={cls('nav-item', {active: router.isActive(l.url)})}
                    key={l.url}>
                  <Link to={l.url}
                        className="nav-link">{l.label}</Link>
                </li>
              ))}
              {logged && logoutButton}
            </ul>
          </div>
        </nav>
      </div>
    );
  }
}
