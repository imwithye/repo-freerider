import { Octokit } from "octokit";
import Table from "cli-table";
async function freeriderPRs({
  owner,
  repo,
  authors,
}: {
  owner: string;
  repo: string;
  authors?: string[];
}) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || "",
  });

  const response = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 50,
    sort: "updated",
    direction: "desc",
  });

  const prs = response.data;
  const filteredPrs = prs.filter(
    (pr) => !authors || authors.includes(pr.user?.login || ""),
  );
  const checkUpdateStatuses = await Promise.all(
    filteredPrs.map(async (pr) => {
      const { data: comparison } = await octokit.rest.repos.compareCommits({
        owner,
        repo,
        base: pr.base.ref,
        head: pr.head.ref,
      });

      return {
        ...pr,
        needsUpdate: comparison.behind_by > 0,
      };
    }),
  );
  const needsUpdatePrs = checkUpdateStatuses.filter((pr) => pr.needsUpdate);
  const output = needsUpdatePrs.map((pr) => {
    return {
      number: pr.number,
      url: pr.html_url,
      author: pr.user?.login || "",
    };
  });
  return output;
}

// Example usage
async function main() {
  try {
    if (!process.env.GITHUB_TOKEN) {
      console.error("GITHUB_TOKEN is not set");
      process.exit(1);
    }
    // Parse command line arguments
    const args = process.argv.slice(2);
    if (!args[0] || args[0].split("/").length !== 2) {
      console.error("Usage: freerider <owner>/<repo>");
      process.exit(1);
    }
    const [owner, repo] = args[0].split("/");

    var table = new Table({ head: ["Number", "Author", "URL"] });
    const prs = await freeriderPRs({
      owner,
      repo,
    });
    for (const pr of prs) {
      table.push([`#${pr.number}`, pr.author, pr.url]);
    }
    console.log(table.toString());
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
