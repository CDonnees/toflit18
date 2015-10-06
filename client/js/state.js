/**
 * TOFLIT18 Client State Tree
 * ===========================
 *
 * Creating the Baobab state tree used by the whole application to function.
 */
import Baobab, {monkey} from 'baobab';
import {
  isLogged
} from './facets';

const defaultState = {

  // Data
  data: {
    classifications: null
  },

  // Some generic UI flags
  flags: {
    logged: monkey(['user'], isLogged),
    login: {
      failed: false,
      loading: false
    }
  },

  // Specific states
  states: {
    classification: {
      browser: {
        selected: null
      }
    }
  },

  // User-related information
  user: null,
};

const tree = new Baobab(defaultState);

export default tree;
