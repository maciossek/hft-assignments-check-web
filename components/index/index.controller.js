const unionBy = require("lodash/unionBy");
const { createApolloFetch } = require("apollo-fetch");

const CLASSROOM_ORG_NAME = process.env.CLASSROOM_ORG_NAME;
const TEACHER_ID = process.env.TEACHER_ID;

const assignmentNames = [
  "hft-asgmt-git",
  "hft-asgmt-html",
  "hft-asgmt-css",
  "hft-asgmt-frontend-development",
  "hft-asgmt-js",
  "hft-asgmt-nodejs",
  "hft-asgmt-js-async"
];

async function indexController(req, res) {
  const apolloFetch = createApolloFetch({
    uri: "https://api.github.com/graphql"
  });

  apolloFetch.use(({ request, options }, next) => {
    if (!options.headers) {
      options.headers = {}; // Create the headers object if needed.
    }
    options.headers["authorization"] = `Bearer ${req.cookies.ghAccessToken}`;

    next();
  });

  let repos = [];

  try {
    repos = await fetchAllRepos(apolloFetch);

    res.render("index/index", {
      CLASSROOM_ORG_NAME,
      data: normalizeRepos(repos),
      assignmentNames
    });
  } catch (e) {
    console.error(e);
  }
}

function normalizeRepos(originalData) {
  const parsedData = new Map();

  originalData
    .filter(item => item.node.url.indexOf("maciossek") === -1)
    .forEach(item => {
      const userObj = {
        user: item.node.collaborators.nodes.filter(
          user => user.login !== "maciossek"
        )[0],
        assignments: [{ name: item.node.name, url: item.node.url }]
      };
      if (!parsedData.has(userObj.user.login)) {
        parsedData.set(userObj.user.login, userObj);
      } else {
        const storedUser = parsedData.get(userObj.user.login);
        const newAssignment = {
          name: item.node.name,
          url: item.node.url
        };

        assignmentNames.indexOf("item.node.name") >=
        assignmentNames.indexOf(
          storedUser.assignments[storedUser.assignments.length - 1].name
        )
          ? storedUser.assignments.push(newAssignment)
          : storedUser.assignments.unshift(newAssignment);
      }
    });
  return Array.from(parsedData.values());
}

async function fetchAllRepos(apolloFetch) {
  let allRepos = [];
  let assignments = await fetchAssignments(apolloFetch);
  if (!assignments.data) {
    throw new Error(assignments.message);
  }
  let hasNextPage =
    assignments.data.organization.repositories.pageInfo.hasNextPage;
  let endCursor = assignments.data.organization.repositories.pageInfo.endCursor;
  allRepos.push(...assignments.data.organization.repositories.edges);

  while (hasNextPage) {
    let nextAssignments;

    try {
      nextAssignments = await fetchNextAssignments(apolloFetch, endCursor);
      if (!nextAssignments.data) {
        throw new Error(nextAssignments.message);
      }
      allRepos.push(...nextAssignments.data.organization.repositories.edges);
      hasNextPage =
        nextAssignments.data.organization.repositories.pageInfo.hasNextPage;
      endCursor =
        nextAssignments.data.organization.repositories.pageInfo.endCursor;
    } catch (e) {
      throw e;
    }
  }

  return allRepos;
}

async function fetchAssignments(apolloFetch) {
  return apolloFetch({
    query: `query($CLASSROOM_ORG_NAME:String!) {
      organization(login: $CLASSROOM_ORG_NAME) {
        repositories(first: 100) {
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
      CLASSROOM_ORG_NAME: CLASSROOM_ORG_NAME
    }
  });
}

async function fetchNextAssignments(apolloFetch, pageCursor) {
  return apolloFetch({
    query: `query($CLASSROOM_ORG_NAME:String! $pageCursor:String!) {
      organization(login: $CLASSROOM_ORG_NAME) {
        repositories(first: 100, after: $pageCursor) {
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
      CLASSROOM_ORG_NAME: CLASSROOM_ORG_NAME,
      pageCursor: pageCursor
    }
  });
}

module.exports = indexController;
