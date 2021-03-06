/**
 * TOFLIT18 Client Application Router
 * ===================================
 *
 * Routing the application.
 */
import React, {Component} from 'react';
import {Router, Route, Redirect} from 'react-router';
import PropTypes from 'baobab-react/prop-types';
import App from './App.jsx';
import Login from './login/Login.jsx';
import Home from './Home.jsx';
import ClassificationPanel from './classification/ClassificationPanel.jsx';
import ClassificationModal from './classification/ClassificationModal.jsx';
import ClassificationBrowser from './classification/ClassificationBrowser.jsx';
import ExplorationPanel from './exploration/ExplorationPanel.jsx';
import ExplorationMeta from './exploration/ExplorationMeta.jsx';
import ExplorationIndicators from './exploration/ExplorationIndicators.jsx';
import ExplorationNetwork from './exploration/ExplorationNetwork.jsx';
import ExplorationTerms from './exploration/ExplorationTerms.jsx';
import GlossaryPanel from './glossary/GlossaryPanel.jsx';
import history from '../history';

export default class AppRouter extends Component {
  static contextTypes = {
    tree: PropTypes.baobab
  };

  render() {

    const isLogged = () => {
      return this.context.tree.get('flags', 'logged');
    };

    return (
      <Router history={history}>
        <Redirect from="/" to="/home" />
        <Route path="/" component={App}>
          <Route path="/login" component={Login} />
          <Route path="/" onEnter={(_, redirect) => !isLogged() && redirect({pathname: '/login'})}>

            <Redirect from="classification" to="classification/browser" />
            <Redirect from="exploration" to="exploration/meta" />

            <Route path="home" component={Home} />
            <Route path="classification" component={ClassificationPanel}>
              <Route path="browser" component={ClassificationBrowser} />
              <Route path="modal" component={ClassificationModal} />
            </Route>
            <Route path="exploration" component={ExplorationPanel}>
              <Route path="meta" component={ExplorationMeta} />
              <Route path="indicators" component={ExplorationIndicators} />
              <Route path="network" component={ExplorationNetwork} />
              <Route path="terms" component={ExplorationTerms} />
            </Route>
            <Route path="glossary" component={GlossaryPanel} />
          </Route>
        </Route>
        <Redirect from="*" to="/" />
      </Router>
    );
  }
}
