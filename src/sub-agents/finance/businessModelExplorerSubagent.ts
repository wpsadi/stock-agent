import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { AsyncSubAgent, SubAgent } from "deepagents";
import { news } from "@mcps/news-mcp";
import { yahooFinance } from "@mcps/yahoo-finance";
import z from "zod";
import { webCrawl } from "@mcps/web-crawler";

const SYSTEM_PROMPT = `
  You are a company intelligence agent that analyzes and extracts structured insights about businesses.

  For every request:
  1. Identify the target company.
  2. Gather relevant information using available tools.
  3. Extract and normalize structured data.
  4. Return a concise, well-organized intelligence summary.

  Core tasks:
  - Business model extraction (how the company operates and makes money)
  - Revenue streams (primary and secondary sources)
  - Products and services
  - Leadership and organizational structure
  - Sector and industry classification

  Workflow:
  1. If company info is required → call get_company_info
  2. If deeper financial context is needed → call get_financial_statements
  3. Synthesize results into structured output

  Rules:
  - Never hallucinate company data.
  - If a field is unavailable, return null.
  - Normalize company names and entities.
  - Prefer tool-based data over assumptions.
  - Keep explanations concise and structured.
  - Avoid generic descriptions—focus on specific insights.

  Output format:
  Return a structured object with:
  - company_name
  - business_model
  - revenue_streams (array)
  - products_services (array)
  - leadership (array of key executives)
  - sector
  - industry
  - notes (optional edge cases or missing info)
`


const responseFormat =  z.object({
  company_name: z
    .string()
    .describe("The official name of the company being analyzed"),

  business_model: z
    .string()
    .describe("Explanation of how the company operates and generates value (e.g., SaaS, marketplace, manufacturing)"),

  revenue_streams: z
    .array(z.string())
    .describe("List of primary and secondary revenue sources (e.g., subscriptions, ads, product sales)"),

  products_services: z
    .array(z.string())
    .describe("Key products and services offered by the company"),

  leadership: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Full name of the executive or leader"),
        role: z
          .string()
          .describe("Position or title within the company (e.g., CEO, CTO)"),
      })
    )
    .describe("List of key executives and leadership members"),

  sector: z
    .string()
    .describe("Broad sector classification (e.g., Technology, Healthcare, Finance)"),

  industry: z
    .string()
    .describe("Specific industry classification within the sector (e.g., Fintech, E-commerce, AI)"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Optional notes for missing data, uncertainties, or special observations"),
});

const businessExplorerSubAgent:SubAgent = {
name:"Company Intelligence Agent",
systemPrompt:SYSTEM_PROMPT,
model:llm,
tools:[internetSearch,...yahooFinance,...news,...webCrawl],
responseFormat,
description:"Extracts and analyzes structured intelligence about a company including business model, revenue streams, products, leadership, and sector classification."
}


export { businessExplorerSubAgent };