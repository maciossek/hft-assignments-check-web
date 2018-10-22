const unionBy = require('lodash/unionBy')
const uniq = require('lodash/uniq')
const { createApolloFetch } = require('apollo-fetch');
const { normalize, schema } = require('normalizr');

const CLASSROOM_ORG_NAME = process.env.CLASSROOM_ORG_NAME
const TEACHER_ID = process.env.TEACHER_ID

async function indexController(req, res) {
  const apolloFetch = createApolloFetch({
    uri: 'https://api.github.com/graphql',
  });

  apolloFetch.use(({ request, options }, next) => {
    if (!options.headers) {
      options.headers = {};  // Create the headers object if needed.
    }
    options.headers['authorization'] = `Bearer ${req.cookies.ghAccessToken}`;
  
    next();
  });

  let repos = []

  try {
    repos = await fetchAllRepos(apolloFetch)
    const normalizedJson = normalizeRepos(repos)
  
    res.render('index/index', { CLASSROOM_ORG_NAME, data: normalizedJson });
  } catch (e) {
    console.error(e)
  }
}

function normalizeRepos(originalData) {
  let users = []
  let userAssignments = []

  const dataWithoutMe = originalData

  dataWithoutMe.forEach((item => {
    repoName = item.node.name

    const user = item.node.collaborators.nodes
    const userAssignment = [{
      name: item.node.name,
      url: item.node.url,
      user: typeof user[1] !== 'undefined' ? user[1].login : user[0].login
    }]
    
    users = unionBy(users, user, 'login')
    userAssignments = unionBy(userAssignments, userAssignment, 'name')
  }))

  users.forEach((item => {
    item.repos = []
    userAssignments.forEach(ua => {
      // console.log(ua.user === item.login, ua.user === item.login)
      if (ua.user === item.login) {
        item.repos.push(ua)
      }
    })
  }))

  return users;
}

async function fetchAllRepos(apolloFetch) {
  let allRepos = []
  let assignments = await fetchAssignments(apolloFetch)
  let hasNextPage = assignments.data.organization.repositories.pageInfo.hasNextPage
  let endCursor = assignments.data.organization.repositories.pageInfo.endCursor
  allRepos.push(...assignments.data.organization.repositories.edges)

  while(hasNextPage) {
    const nextAssignments = await fetchNextAssignments(apolloFetch, endCursor)
    console.log(apolloFetch)
    allRepos.push(...nextAssignments.data.organization.repositories.edges)
    hasNextPage = nextAssignments.data.organization.repositories.pageInfo.hasNextPage
    endCursor = nextAssignments.data.organization.repositories.pageInfo.endCursor
  }

  return allRepos
}

async function fetchAssignments(apolloFetch) {
  return apolloFetch({
    query: `query($CLASSROOM_ORG_NAME:String!) {
      organization(login: $CLASSROOM_ORG_NAME) {
        repositories(first: 2) {
          edges {
            node {
              id
              url
              name
              collaborators(first: 10) {
                nodes {
                  id
                  name
                  login
                  email
                }
              }
            }
            cursor
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }`,
    variables: {
      "CLASSROOM_ORG_NAME": CLASSROOM_ORG_NAME
    },
  })
}

async function fetchNextAssignments(apolloFetch, pageCursor) {
  return apolloFetch({
    query: `query($CLASSROOM_ORG_NAME:String! $pageCursor:String!) {
      organization(login: $CLASSROOM_ORG_NAME) {
        repositories(first: 2, after: $pageCursor) {
          edges {
            node {
              id
              url
              name
              collaborators(first: 10) {
                nodes {
                  id
                  name
                  login
                  email
                }
              }
            }
            cursor
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }`,
    variables: {
      "CLASSROOM_ORG_NAME": CLASSROOM_ORG_NAME,
      "pageCursor": pageCursor
    }
  })
}

module.exports = indexController;
