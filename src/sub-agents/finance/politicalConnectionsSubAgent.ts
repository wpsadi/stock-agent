import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { webCrawl } from "@mcps/web-crawler";
import z from "zod";

const SYSTEM_PROMPT = `
You are a political connections and influence analysis agent that uncovers relationships between companies and politicians, and identifies political favors that benefit the company.

For every request:
1. Identify the target company and its key executives.
2. Map political connections and donations.
3. Identify regulatory favors or policy advantages.
4. Assess political risk exposure.
5. Detect conflicts of interest.

Core tasks:
- Executive political affiliations and donations
- Lobbying activities and expenditures
- Regulatory capture analysis (favorable treatment)
- Legislation impacting the company
- Political risk assessment

Workflow:
1. Use internet_search → search for "[company] political donations", "[company] lobbying", "[CEO] PAC contributions", "[company] regulatory favors"
2. Use news_search → recent political developments, legislation, investigations
3. Use web_crawl → FEC filings, lobbying disclosure reports, congressional records
4. Cross-reference political connections with policy outcomes
5. Assess materiality of political influence on business operations

Rules:
- Use only verifiable public records (FEC, lobbying disclosures, SEC filings).
- Distinguish between direct contributions and PAC/association spending.
- Flag potential conflicts of interest explicitly.
- Do not speculate—only report documented connections and favors.
- Cite specific amounts, dates, and recipients for all political spending.

Output format:
Return a structured object with:
- company_name
- executives_analyzed (array of key executives reviewed)
- political_connections
  - campaign_contributions (total by party and key recipients)
  - lobbying_expenditures (annual spend and firms used)
  - PAC_activities (company PAC totals and distribution)
- political_favors
  - regulatory_favors (favorable rulings, delayed enforcement)
  - tax_benefits (subsidies, tax breaks, incentives)
  - government_contracts (awards, no-bid contracts)
  - legislation_benefits (bills that advantage the company)
- conflicts_of_interest
  - revolving_door (ex-officials now working for company)
  - board_members_with_political_roles
  - family_connections_to_politicians
- risk_assessment
  - political_dependence_score (0-1)
  - party_alignment (Democrat/Republican/Both/Neutral)
  - exposure_to_policy_changes (high/medium/low)
- red_flags (array of concerning connections needing monitoring)
- notes
`;

const responseFormat = z.object({
  company_name: z.string().describe("Target company name"),

  executives_analyzed: z
    .array(z.string())
    .describe("List of key executives and board members whose political connections were analyzed"),

  political_connections: z
    .object({
      campaign_contributions: z
        .object({
          total_direct: z.number().nullable().describe("Total direct contributions by company/execs"),
          total_pac: z.number().nullable().describe("Total PAC contributions"),
          democrat_pct: z.number().nullable().describe("Percentage to Democratic candidates"),
          republican_pct: z.number().nullable().describe("Percentage to Republican candidates"),
          top_recipients: z
            .array(
              z.object({
                recipient: z.string(),
                amount: z.number(),
                party: z.string(),
                year: z.string(),
              })
            )
            .describe("Top 5 largest contributions with recipient, amount, party, and year"),
          source: z.string().nullable().describe("Source of contribution data (FEC, OpenSecrets, etc.)"),
        })
        .describe("Political campaign contributions"),

      lobbying_expenditures: z
        .object({
          annual_spend: z
            .array(
              z.object({
                year: z.string(),
                amount: z.number(),
              })
            )
            .describe("Annual lobbying spend by year"),
          top_firms: z
            .array(z.string())
            .describe("Top lobbying firms used"),
          key_issues_lobbied: z.array(z.string()).describe("Main policy areas lobbied on"),
          source: z.string().nullable().describe("Source of lobbying data (Senate LDA, etc.)"),
        })
        .describe("Lobbying activities and costs"),

      pac_activities: z
        .object({
          company_pac_name: z.string().nullable().describe("Name of company PAC"),
          total_disbursements: z.number().nullable().describe("Total PAC spending"),
          distribution_by_party: z
            .object({
              democrat: z.number().nullable(),
              republican: z.number().nullable(),
              other: z.number().nullable(),
            })
            .describe("PAC spending distribution by party"),
          top_pac_recipients: z
            .array(
              z.object({
                recipient: z.string(),
                amount: z.number(),
                party: z.string(),
              })
            )
            .describe("Top PAC beneficiaries"),
          source: z.string().nullable(),
        })
        .describe("Political Action Committee activities"),
    })
    .describe("Political spending and connections"),

  political_favors: z
    .object({
      regulatory_favors: z
        .array(
          z.object({
            description: z.string().describe("Description of favorable treatment"),
            regulator: z.string().describe("Agency providing the favor"),
            date: z.string().describe("Date of action"),
            estimated_value: z.number().nullable().describe("Monetary value of benefit if quantifiable"),
            source: z.string().describe("Source documenting the favor"),
          })
        )
        .describe("Regulatory decisions that benefit the company"),
      tax_benefits: z
        .array(
          z.object({
            type: z.string().describe("Type of tax benefit (subsidy, abatement, credit)"),
            jurisdiction: z.string().describe("Federal/state/local jurisdiction"),
            amount: z.number().nullable().describe("Value of benefit"),
            duration: z.string().nullable().describe("Time period of benefit"),
            source: z.string(),
          })
        )
        .describe("Tax advantages and incentives"),
      government_contracts: z
        .array(
          z.object({
            agency: z.string().describe("Government agency"),
            contract_value: z.number().nullable(),
            contract_type: z.string().describe("Type of contract"),
            award_method: z.string().describe("Competitive/no-bid/sole-source"),
            year: z.string(),
            source: z.string(),
          })
        )
        .describe("Government contracts and awards"),
      legislation_benefits: z
        .array(
          z.object({
            bill_name: z.string().describe("Name/number of legislation"),
            benefit_description: z.string().describe("How the bill helps the company"),
            status: z.string().describe("Bill status (passed, pending, failed)"),
            sponsor: z.string().describe("Primary sponsor"),
            party_sponsor: z.string().nullable(),
            source: z.string(),
          })
        )
        .describe("Pending or passed legislation that benefits the company"),
    })
    .describe("Political favors and advantages received"),

  conflicts_of_interest: z
    .object({
      revolving_door: z
        .array(
          z.object({
            person_name: z.string().describe("Former official/employee"),
            prior_role: z.string().describe("Government position held"),
            prior_agency: z.string().describe("Government agency"),
            current_role: z.string().describe("Current position at company"),
            transition_year: z.string().describe("Year of transition"),
            source: z.string(),
          })
        )
        .describe("Former government officials now working for the company"),
      board_political_roles: z
        .array(
          z.object({
            board_member: z.string(),
            political_position: z.string(),
            party_affiliation: z.string().nullable(),
            source: z.string(),
          })
        )
        .describe("Board members with current/former political roles"),
      family_connections: z
        .array(
          z.object({
            executive: z.string().describe("Company executive"),
            relative: z.string().describe("Family member"),
            political_role: z.string().describe("Political position/connection"),
            relationship: z.string().describe("Type of relationship"),
            source: z.string(),
          })
        )
        .describe("Family ties to politicians"),
    })
    .describe("Potential conflicts of interest"),

  risk_assessment: z
    .object({
      political_dependence_score: z
        .number()
        .describe("Score 0-1 indicating dependence on political favors/government contracts"),
      party_alignment: z
        .enum(["Democrat", "Republican", "Both", "Neutral", "Unknown"])
        .describe("Primary political party alignment based on contributions"),
      exposure_to_policy_changes: z
        .enum(["high", "medium", "low"])
        .describe("How exposed company is to policy/regulatory changes"),
      key_political_risks: z
        .array(z.string())
        .describe("Political risks that could negatively impact the company"),
      favorable_policy_leverage: z
        .number()
        .nullable()
        .describe("Score 0-10 indicating ability to secure favorable policies"),
    })
    .describe("Political risk and exposure analysis"),

  red_flags: z
    .array(
      z.object({
        issue: z.string().describe("Concise flag title"),
        details: z.string().describe("Explanation of the concern"),
        materiality: z.enum(["low", "medium", "high"]).describe("How significant the flag is"),
        source: z.string().describe("Source documenting this"),
      })
    )
    .describe("Critical concerns requiring monitoring"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Additional context, data gaps, or important caveats"),
});

const politicalConnectionsSubAgent: SubAgent = {
  name: "Political Connections Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...webCrawl],
  responseFormat,
  description:
    "Maps political connections, campaign contributions, lobbying activities, regulatory favors, and conflicts of interest between companies and politicians.",
};

export { politicalConnectionsSubAgent };
