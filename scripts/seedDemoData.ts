import { db } from "../server/db";
import { 
  users, managers, sdrs, accountExecutives, leads, 
  researchPackets, callSessions, managerCallAnalyses 
} from "../shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

const DEMO_PASSWORD = "HRdemo2026";

const MANAGER_DATA = [
  {
    name: "Roberto Hernandez",
    email: "roberto.hernandez@hawkridgesys.com",
    phone: "+1 (555) 234-5678",
    title: "Senior Sales Manager",
    bio: "15+ years in B2B services sales. Former top performer at Accenture who transitioned to leadership. Passionate about developing SDRs into top closers through data-driven coaching and weekly call reviews.",
    coachingStyle: "Collaborative and metrics-focused. Believes in celebrating wins publicly and coaching improvements privately. Known for detailed call breakdowns and role-playing exercises.",
    specialties: "Enterprise Outsourcing, Build & Transfer Programs, Complex Deal Cycles",
    yearsExperience: 15,
    certifications: "Sandler Sales Certification, SPIN Selling, Challenger Sale Methodology"
  },
  {
    name: "Carmen Delgado",
    email: "carmen.delgado@hawkridgesys.com",
    phone: "+1 (555) 345-6789",
    title: "Regional Sales Manager - West",
    bio: "Started as an SDR at BSA Solutions 8 years ago and worked her way up. Deep understanding of the E-commerce and SaaS verticals. Champions a growth mindset approach.",
    coachingStyle: "Empathetic listener who focuses on building confidence. Uses real customer stories to illustrate best practices. Weekly 1:1s are sacred.",
    specialties: "E-Commerce Vertical, SaaS Clients, New Hire Onboarding",
    yearsExperience: 8,
    certifications: "Miller Heiman Strategic Selling, HR Outsourcing Specialist"
  },
  {
    name: "Luis Morales",
    email: "luis.morales@hawkridgesys.com",
    phone: "+1 (555) 456-7890",
    title: "Director of Sales Development",
    bio: "Former operations background gives him credibility with prospects. Built the SDR program from scratch when he joined 5 years ago. Now oversees all SDR training and development.",
    coachingStyle: "Process-oriented mentor who helps SDRs understand outsourcing deeply. Focuses on discovery questions and value-based selling. Runs monthly SDR bootcamps.",
    specialties: "Technical Sales, Value Selling, Dedicated Team Solutions",
    yearsExperience: 12,
    certifications: "Operations Management Degree, MEDDIC Certified, Solution Selling"
  },
];

const SDR_DATA = [
  { name: "Carlos Martinez", email: "carlos.martinez@hawkridgesys.com", gender: "male", bio: "Top performer who joined 2 years ago from SaaS sales. Natural relationship builder with strong discovery skills. Working on improving objection handling with operations decision-makers.", strengths: "Rapport building, Discovery questions, Follow-up discipline", developmentAreas: "Operations objections, C-level conversations", goals: "Move to AE role within 18 months", yearsExperience: 2, previousCompany: "HubSpot", specialties: "SMB E-Commerce" },
  { name: "Maria Rodriguez", email: "maria.rodriguez@hawkridgesys.com", gender: "female", bio: "Highest connect rate on the team. Former teacher who brings exceptional communication skills. Excels at building trust quickly but working on being more assertive in closing.", strengths: "Communication, Active listening, Call prep", developmentAreas: "Assertiveness, Closing techniques", goals: "Consistently hit 120% of quota", yearsExperience: 1, previousCompany: "Education Sector", specialties: "Healthcare, Professional Services" },
  { name: "Juan Gonzalez", email: "juan.gonzalez@hawkridgesys.com", gender: "male", bio: "Operations background makes him highly credible with ops buyers. Sometimes spends too long on process discussions. Working on qualifying faster.", strengths: "Operations knowledge, Problem identification, Process expertise", developmentAreas: "Time management, Qualification speed", goals: "Become the operations SME for the team", yearsExperience: 3, previousCompany: "Genpact", specialties: "Technology, SaaS" },
  { name: "Ana Torres", email: "ana.torres@hawkridgesys.com", gender: "female", bio: "Rising star who broke the monthly meeting record last quarter. Highly competitive and loves the leaderboard. Coaching her on sustainable pacing and work-life balance.", strengths: "Persistence, Competitive drive, Energy", developmentAreas: "Pacing, Account research depth", goals: "President's Club qualification", yearsExperience: 1, previousCompany: "Salesforce", specialties: "Technology, Startups" },
  { name: "Diego Ramirez", email: "diego.ramirez@hawkridgesys.com", gender: "male", bio: "Steady performer who never misses quota. Great mentor to new hires. Working on pushing beyond comfort zone to achieve stretch goals.", strengths: "Consistency, Mentorship, Process discipline", developmentAreas: "Risk-taking, Enterprise pursuit", goals: "Team lead position", yearsExperience: 4, previousCompany: "Oracle", specialties: "Mid-Market, Financial Services" },
  { name: "Sofia Vargas", email: "sofia.vargas@hawkridgesys.com", gender: "female", bio: "Creative approach to prospecting with strong LinkedIn game. Sometimes over-relies on digital channels. Working on phone confidence.", strengths: "Social selling, Creative messaging, Research", developmentAreas: "Cold calling, Voice presence", goals: "Develop multi-channel mastery", yearsExperience: 1, previousCompany: "Marketing Agency", specialties: "Consumer Brands, Retail" },
  { name: "Miguel Flores", email: "miguel.flores@hawkridgesys.com", gender: "male", bio: "Recently promoted from BDR. Strong work ethic but still building service knowledge. Putting in extra time on training modules.", strengths: "Work ethic, Coachability, Positive attitude", developmentAreas: "Service knowledge, Industry expertise", goals: "Master the full BSA service portfolio", yearsExperience: 1, previousCompany: "Inside Sales at Dell", specialties: "General SMB" },
  { name: "Isabella Sanchez", email: "isabella.sanchez@hawkridgesys.com", gender: "female", bio: "Data-driven approach to sales. Uses analytics to optimize call times and messaging. Sometimes over-analyzes instead of acting.", strengths: "Analytics, Strategy, A/B testing", developmentAreas: "Speed to action, Intuitive selling", goals: "Build the team's data playbook", yearsExperience: 2, previousCompany: "ZoomInfo", specialties: "Enterprise Accounts" },
  { name: "Fernando Castro", email: "fernando.castro@hawkridgesys.com", gender: "male", bio: "Experienced rep who joined from a competitor. Deep industry knowledge but adapting to our sales methodology. Excellent at identifying pain points.", strengths: "Industry expertise, Pain discovery, Competitive positioning", developmentAreas: "Adopting new processes, CRM discipline", goals: "Top 3 performer by year end", yearsExperience: 5, previousCompany: "TaskUs", specialties: "BPO, Customer Support" },
  { name: "Valentina Reyes", email: "valentina.reyes@hawkridgesys.com", gender: "female", bio: "Excellent at handling objections with empathy. Strong emotional intelligence helps her navigate difficult conversations. Building more industry knowledge.", strengths: "Empathy, Objection handling, Relationship depth", developmentAreas: "Industry terminology, ROI discussions", goals: "Increase average deal size", yearsExperience: 2, previousCompany: "Insurance Sales", specialties: "Professional Services" },
  { name: "Alejandro Mendoza", email: "alejandro.mendoza@hawkridgesys.com", gender: "male", bio: "High-volume caller who focuses on activity metrics. Working on quality over quantity - having deeper conversations instead of quick dials.", strengths: "Activity volume, Energy, Resilience", developmentAreas: "Conversation depth, Qualification rigor", goals: "Improve conversion rate by 20%", yearsExperience: 1, previousCompany: "Call Center", specialties: "SMB, Quick Wins" },
  { name: "Camila Ortiz", email: "camila.ortiz@hawkridgesys.com", gender: "female", bio: "Strongest email writer on the team. Personalized sequences get high open rates. Phone skills improving with practice.", strengths: "Written communication, Personalization, Creativity", developmentAreas: "Phone presence, Live discovery", goals: "Develop phone confidence to match email strength", yearsExperience: 1, previousCompany: "Content Marketing", specialties: "Education, Research" },
  { name: "Gabriel Jimenez", email: "gabriel.jimenez@hawkridgesys.com", gender: "male", bio: "Former BPO manager who knows outsourcing inside and out. Can sometimes get too detailed too fast. Learning to lead with business value.", strengths: "Service mastery, Process expertise, User empathy", developmentAreas: "Business case building, Executive messaging", goals: "Become certified outsourcing consultant", yearsExperience: 2, previousCompany: "Teleperformance", specialties: "Customer Support, Back Office" },
  { name: "Lucia Romero", email: "lucia.romero@hawkridgesys.com", gender: "female", bio: "New hire showing tremendous promise. Fast learner who asks great questions. In ramp period but already booking meetings.", strengths: "Curiosity, Quick learning, Positive attitude", developmentAreas: "Building experience, Handling pressure", goals: "Complete ramp in record time", yearsExperience: 0, previousCompany: "Recent Graduate", specialties: "Learning all verticals" },
  { name: "Andres Navarro", email: "andres.navarro@hawkridgesys.com", gender: "male", bio: "Consistent mid-performer working on breakthrough to top tier. Has the skills but needs more confidence. Focus on mindset coaching.", strengths: "Reliability, Follow-through, Preparation", developmentAreas: "Confidence, Asking for the meeting", goals: "Break into top 5 performers", yearsExperience: 2, previousCompany: "Telecommunications", specialties: "Tech Support, IT Services" },
  { name: "Paula Gutierrez", email: "paula.gutierrez@hawkridgesys.com", gender: "female", bio: "Excellent at researching accounts and building targeted messaging. Sometimes spends too long preparing vs. calling. Balance in progress.", strengths: "Research depth, Account planning, Targeting", developmentAreas: "Execution speed, Call volume", goals: "Optimize research-to-call ratio", yearsExperience: 1, previousCompany: "Market Research", specialties: "Enterprise, Strategic Accounts" },
  { name: "Sebastian Ruiz", email: "sebastian.ruiz@hawkridgesys.com", gender: "male", bio: "Strong closer who excels at getting meetings from qualified conversations. Working on earlier qualification to avoid wasted time on bad fits.", strengths: "Closing, Urgency creation, Confidence", developmentAreas: "Early qualification, Discovery discipline", goals: "Highest meeting-to-opportunity rate", yearsExperience: 3, previousCompany: "Real Estate Sales", specialties: "Fast-moving deals" },
  { name: "Elena Diaz", email: "elena.diaz@hawkridgesys.com", gender: "female", bio: "Bilingual advantage helps with Latin American accounts. Building relationships across borders. Working on navigating longer sales cycles.", strengths: "Bilingual, Cultural intelligence, Patience", developmentAreas: "Urgency tactics, Shortening cycles", goals: "Expand LATAM territory success", yearsExperience: 2, previousCompany: "International Trade", specialties: "LATAM, Multinational" },
  { name: "Ricardo Herrera", email: "ricardo.herrera@hawkridgesys.com", gender: "male", bio: "Struggled initially but has made remarkable improvement over past 6 months. Example of coachability and persistence paying off.", strengths: "Coachability, Persistence, Growth mindset", developmentAreas: "Consistency, Peak performance", goals: "Maintain top-half performance", yearsExperience: 1, previousCompany: "Retail Management", specialties: "Consumer Goods" },
  { name: "Daniela Aguilar", email: "daniela.aguilar@hawkridgesys.com", gender: "female", bio: "Team collaborator who shares wins and learnings freely. Strong network within accounts. Building individual contributor strength.", strengths: "Collaboration, Account mapping, Team spirit", developmentAreas: "Solo performance, Competitive edge", goals: "Balance team contribution with personal results", yearsExperience: 2, previousCompany: "Account Management", specialties: "Existing Customer Expansion" },
];

const AE_DATA = [
  { name: "Patricia Vega", email: "patricia.vega@hawkridgesys.com", phone: "+1 (555) 567-8901", region: "West", specialty: "Enterprise", title: "Senior Account Executive", bio: "President's Club winner 3 years running. Expert at navigating complex enterprise outsourcing deals with multiple stakeholders. Known for large Build & Transfer programs.", dealFocus: "Enterprise deals $500K+", yearsExperience: 12, quotaAttainment: 142, avgDealSize: 450000 },
  { name: "Eduardo Silva", email: "eduardo.silva@hawkridgesys.com", phone: "+1 (555) 678-9012", region: "East", specialty: "Mid-Market", title: "Account Executive", bio: "High-volume closer who excels at mid-market E-commerce and SaaS deals. Fast deal cycles and strong closing skills. Former SDR who knows how to work with the team.", dealFocus: "Mid-market $50K-$200K deals", yearsExperience: 6, quotaAttainment: 118, avgDealSize: 85000 },
  { name: "Monica Cruz", email: "monica.cruz@hawkridgesys.com", phone: "+1 (555) 789-0123", region: "Central", specialty: "Customer Support", title: "Account Executive - Customer Experience", bio: "Deep customer support expertise from previous role at a BPO. Understands contact center challenges and speaks the customer's language. Growing enterprise skills.", dealFocus: "Customer support teams, help desks", yearsExperience: 5, quotaAttainment: 105, avgDealSize: 120000 },
  { name: "Felipe Ramos", email: "felipe.ramos@hawkridgesys.com", phone: "+1 (555) 890-1234", region: "South", specialty: "Healthcare", title: "Account Executive - Healthcare", bio: "Specialized in healthcare and life sciences accounts. Understands compliance requirements and HIPAA needs. Building pipeline in emerging healthtech.", dealFocus: "Healthcare operations, medical billing", yearsExperience: 8, quotaAttainment: 95, avgDealSize: 180000 },
  { name: "Teresa Luna", email: "teresa.luna@hawkridgesys.com", phone: "+1 (555) 901-2345", region: "Northeast", specialty: "Technology", title: "Account Executive - Technology", bio: "Tech sector specialist who works with SaaS companies, startups, and FinTech firms. Strong at competitive displacement from other BPO providers.", dealFocus: "SaaS, FinTech, Technology", yearsExperience: 7, quotaAttainment: 112, avgDealSize: 95000 },
];

const REAL_COMPANIES = [
  { name: "Shopify Plus", website: "https://shopify.com", industry: "E-Commerce", size: "10000+", painPoints: ["Customer support ticket backlog growing", "24/7 coverage gaps in support", "High cost of US-based support agents"], products: "E-commerce platform, merchant services" },
  { name: "BigCommerce", website: "https://bigcommerce.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Scaling support with merchant growth", "Technical support hiring challenges", "Chat support response time issues"], products: "E-commerce platform, B2B commerce" },
  { name: "WooCommerce (Automattic)", website: "https://woocommerce.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Plugin support ticket volume", "Developer support bottlenecks", "Community management resources"], products: "WordPress e-commerce plugin" },
  { name: "Klaviyo", website: "https://klaviyo.com", industry: "SaaS", size: "1000-5000", painPoints: ["Customer onboarding capacity", "Technical support scaling", "Data migration assistance needs"], products: "Marketing automation, email platform" },
  { name: "Stripe", website: "https://stripe.com", industry: "FinTech", size: "5000-10000", painPoints: ["Developer support queue times", "Integration assistance demand", "Fraud review team capacity"], products: "Payment processing, financial infrastructure" },
  { name: "Square", website: "https://squareup.com", industry: "FinTech", size: "5000-10000", painPoints: ["Merchant onboarding backlog", "Hardware support ticket volume", "Multi-language support needs"], products: "Payment solutions, business tools" },
  { name: "Brex", website: "https://brex.com", industry: "FinTech", size: "1000-5000", painPoints: ["Customer success team scaling", "Expense report processing", "Compliance review capacity"], products: "Corporate cards, spend management" },
  { name: "Ramp", website: "https://ramp.com", industry: "FinTech", size: "500-1000", painPoints: ["Rapid customer growth outpacing support", "Finance operations bottlenecks", "Implementation team capacity"], products: "Corporate cards, expense management" },
  { name: "Gusto", website: "https://gusto.com", industry: "SaaS", size: "1000-5000", painPoints: ["Payroll support scaling challenges", "Tax filing season surge", "HR support ticket backlog"], products: "Payroll, HR, benefits platform" },
  { name: "Rippling", website: "https://rippling.com", industry: "SaaS", size: "1000-5000", painPoints: ["Implementation team constraints", "IT support ticket volume", "Multi-product support complexity"], products: "HR, IT, finance platform" },
  { name: "Lattice", website: "https://lattice.com", industry: "SaaS", size: "500-1000", painPoints: ["Customer success hiring lag", "Implementation backlog", "Support response time issues"], products: "People management platform" },
  { name: "Culture Amp", website: "https://cultureamp.com", industry: "SaaS", size: "500-1000", painPoints: ["Survey analysis support", "Customer onboarding delays", "Global support coverage gaps"], products: "Employee engagement platform" },
  { name: "BambooHR", website: "https://bamboohr.com", industry: "SaaS", size: "500-1000", painPoints: ["Support ticket growth", "Implementation team capacity", "SMB customer success scaling"], products: "HR software for SMBs" },
  { name: "Zendesk", website: "https://zendesk.com", industry: "SaaS", size: "5000-10000", painPoints: ["Tier 1 support cost reduction", "24/7 chat support needs", "Technical troubleshooting capacity"], products: "Customer service software" },
  { name: "Freshworks", website: "https://freshworks.com", industry: "SaaS", size: "5000-10000", painPoints: ["Multi-product support complexity", "Global time zone coverage", "Onboarding team scaling"], products: "Business software suite" },
  { name: "Intercom", website: "https://intercom.com", industry: "SaaS", size: "1000-5000", painPoints: ["Customer success capacity", "Technical support demand", "Implementation assistance needs"], products: "Customer messaging platform" },
  { name: "Drift", website: "https://drift.com", industry: "SaaS", size: "500-1000", painPoints: ["Conversation routing support", "Bot training resources", "Customer onboarding delays"], products: "Conversational marketing platform" },
  { name: "HubSpot", website: "https://hubspot.com", industry: "SaaS", size: "5000-10000", painPoints: ["Partner support scaling", "Free tier support costs", "Implementation team backlog"], products: "CRM, marketing, sales platform" },
  { name: "Monday.com", website: "https://monday.com", industry: "SaaS", size: "1000-5000", painPoints: ["Customer success hiring", "Enterprise onboarding capacity", "Multi-language support needs"], products: "Work management platform" },
  { name: "Asana", website: "https://asana.com", industry: "SaaS", size: "1000-5000", painPoints: ["Support queue times", "Enterprise implementation delays", "Customer success scaling"], products: "Work management software" },
  { name: "Oscar Health", website: "https://hioscar.com", industry: "Healthcare", size: "1000-5000", painPoints: ["Member services scaling", "Claims processing backlog", "Provider support capacity"], products: "Health insurance technology" },
  { name: "Clover Health", website: "https://cloverhealth.com", industry: "Healthcare", size: "1000-5000", painPoints: ["Medicare support demands", "Care coordination staffing", "Prior authorization processing"], products: "Medicare advantage plans" },
  { name: "Devoted Health", website: "https://devoted.com", industry: "Healthcare", size: "1000-5000", painPoints: ["Concierge support capacity", "Member engagement resources", "Claims adjudication support"], products: "Medicare health plans" },
  { name: "Bright Health", website: "https://brighthealth.com", industry: "Healthcare", size: "1000-5000", painPoints: ["Customer service volume", "Provider network support", "Enrollment processing capacity"], products: "Health insurance plans" },
  { name: "Hims & Hers", website: "https://forhims.com", industry: "Healthcare", size: "1000-5000", painPoints: ["Customer support demand", "Provider scheduling support", "Prescription processing backlog"], products: "Telehealth, wellness products" },
  { name: "Ro (Roman)", website: "https://ro.co", industry: "Healthcare", size: "500-1000", painPoints: ["Patient support scaling", "Pharmacy operations support", "Provider coordination needs"], products: "Digital health clinic" },
  { name: "Teladoc Health", website: "https://teladoc.com", industry: "Healthcare", size: "5000-10000", painPoints: ["24/7 support requirements", "Provider scheduling support", "Technical support for virtual visits"], products: "Virtual healthcare services" },
  { name: "Amwell", website: "https://amwell.com", industry: "Healthcare", size: "1000-5000", painPoints: ["Platform support demand", "Provider onboarding capacity", "Patient technical assistance"], products: "Telehealth platform" },
  { name: "Doctor On Demand", website: "https://doctorondemand.com", industry: "Healthcare", size: "500-1000", painPoints: ["Appointment scheduling support", "Insurance verification backlog", "Patient follow-up capacity"], products: "Virtual care services" },
  { name: "MDLive", website: "https://mdlive.com", industry: "Healthcare", size: "500-1000", painPoints: ["Member support scaling", "Provider support needs", "Technical troubleshooting demand"], products: "Virtual healthcare" },
  { name: "Chewy", website: "https://chewy.com", industry: "E-Commerce", size: "10000+", painPoints: ["Pet expert customer service scaling", "24/7 support coverage", "Peak season staffing challenges"], products: "Pet products e-commerce" },
  { name: "Wayfair", website: "https://wayfair.com", industry: "E-Commerce", size: "10000+", painPoints: ["Furniture specialist support", "Delivery coordination team", "Returns processing capacity"], products: "Home goods e-commerce" },
  { name: "Etsy", website: "https://etsy.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Seller support scaling", "Trust & safety team capacity", "Buyer support demand"], products: "Handmade goods marketplace" },
  { name: "Poshmark", website: "https://poshmark.com", industry: "E-Commerce", size: "500-1000", painPoints: ["Seller community support", "Authentication services scaling", "Customer service demand"], products: "Fashion resale marketplace" },
  { name: "ThredUp", website: "https://thredup.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Item processing backlog", "Customer support volume", "Seller payout inquiries"], products: "Online consignment, thrift" },
  { name: "StockX", website: "https://stockx.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Authentication team scaling", "Customer disputes handling", "Seller support demand"], products: "Sneaker and streetwear marketplace" },
  { name: "Fanatics", website: "https://fanatics.com", industry: "E-Commerce", size: "10000+", painPoints: ["Game day support surges", "Order fulfillment support", "Licensing inquiry handling"], products: "Sports merchandise" },
  { name: "GOAT", website: "https://goat.com", industry: "E-Commerce", size: "500-1000", painPoints: ["Authentication backlog", "International support coverage", "Dispute resolution capacity"], products: "Sneaker marketplace" },
  { name: "Faire", website: "https://faire.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Retailer onboarding support", "Brand partner management", "Order issue resolution"], products: "Wholesale marketplace" },
  { name: "Alibaba.com", website: "https://alibaba.com", industry: "E-Commerce", size: "10000+", painPoints: ["Cross-border trade support", "Supplier verification team", "Buyer protection capacity"], products: "B2B e-commerce platform" },
  { name: "Allbirds", website: "https://allbirds.com", industry: "E-Commerce", size: "500-1000", painPoints: ["Returns processing support", "Sustainability inquiries", "International expansion support"], products: "Sustainable footwear" },
  { name: "Warby Parker", website: "https://warbyparker.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Virtual try-on support", "Prescription verification", "Store appointment scheduling"], products: "Eyewear, DTC" },
  { name: "Glossier", website: "https://glossier.com", industry: "E-Commerce", size: "500-1000", painPoints: ["Beauty advisor support", "Social community management", "Order fulfillment support"], products: "Beauty and skincare" },
  { name: "Fabletics", website: "https://fabletics.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Subscription management support", "VIP member services", "Returns processing capacity"], products: "Activewear subscription" },
  { name: "Rent the Runway", website: "https://renttherunway.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Styling consultation demand", "Rental logistics support", "Customer service scaling"], products: "Fashion rental service" },
  { name: "Stitch Fix", website: "https://stitchfix.com", industry: "E-Commerce", size: "5000-10000", painPoints: ["Styling team capacity", "Returns processing", "Customer feedback handling"], products: "Personal styling service" },
  { name: "Grove Collaborative", website: "https://grove.co", industry: "E-Commerce", size: "500-1000", painPoints: ["Subscription support needs", "Product recommendation support", "Sustainability inquiry handling"], products: "Eco-friendly household products" },
  { name: "Thrive Market", website: "https://thrivemarket.com", industry: "E-Commerce", size: "500-1000", painPoints: ["Member services scaling", "Product sourcing inquiries", "Order fulfillment support"], products: "Healthy food membership" },
  { name: "Boxed", website: "https://boxed.com", industry: "E-Commerce", size: "500-1000", painPoints: ["Bulk order support", "B2B customer service", "Delivery coordination needs"], products: "Bulk goods e-commerce" },
  { name: "Instacart", website: "https://instacart.com", industry: "E-Commerce", size: "5000-10000", painPoints: ["Shopper support scaling", "Customer issue resolution", "Retailer partner support"], products: "Grocery delivery platform" },
  { name: "DoorDash", website: "https://doordash.com", industry: "E-Commerce", size: "5000-10000", painPoints: ["Dasher support scaling", "Restaurant partner support", "Customer issue resolution"], products: "Food delivery platform" },
  { name: "Grubhub", website: "https://grubhub.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Driver support capacity", "Restaurant onboarding", "Order issue handling"], products: "Food delivery service" },
  { name: "Postmates (Uber)", website: "https://postmates.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Fleet support needs", "Merchant support scaling", "Customer service demand"], products: "On-demand delivery" },
  { name: "Gopuff", website: "https://gopuff.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["24/7 support coverage", "Driver coordination", "Customer service volume"], products: "Instant delivery" },
  { name: "Shipt", website: "https://shipt.com", industry: "E-Commerce", size: "1000-5000", painPoints: ["Shopper support needs", "Member services scaling", "Order issue resolution"], products: "Same-day delivery" },
  { name: "Zapier", website: "https://zapier.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support demand", "Integration troubleshooting", "Customer success scaling"], products: "Automation platform" },
  { name: "Notion", website: "https://notion.so", industry: "SaaS", size: "500-1000", painPoints: ["User onboarding support", "Enterprise implementation", "Technical support scaling"], products: "Productivity software" },
  { name: "Figma", website: "https://figma.com", industry: "SaaS", size: "1000-5000", painPoints: ["Designer support scaling", "Enterprise onboarding", "Technical support demand"], products: "Design collaboration tool" },
  { name: "Canva", website: "https://canva.com", industry: "SaaS", size: "1000-5000", painPoints: ["Free tier support volume", "Enterprise customer success", "Content moderation needs"], products: "Design platform" },
  { name: "Miro", website: "https://miro.com", industry: "SaaS", size: "1000-5000", painPoints: ["User support scaling", "Enterprise implementation", "Template support needs"], products: "Visual collaboration platform" },
  { name: "Airtable", website: "https://airtable.com", industry: "SaaS", size: "500-1000", painPoints: ["User support demand", "Enterprise onboarding", "Template and integration support"], products: "Low-code database platform" },
  { name: "ClickUp", website: "https://clickup.com", industry: "SaaS", size: "500-1000", painPoints: ["Rapid growth support needs", "Migration assistance demand", "Technical support scaling"], products: "Project management platform" },
  { name: "Linear", website: "https://linear.app", industry: "SaaS", size: "100-500", painPoints: ["Customer success resources", "Enterprise onboarding needs", "Technical support demand"], products: "Issue tracking software" },
  { name: "Webflow", website: "https://webflow.com", industry: "SaaS", size: "500-1000", painPoints: ["Designer support scaling", "Enterprise implementation", "Technical troubleshooting"], products: "No-code website builder" },
  { name: "Retool", website: "https://retool.com", industry: "SaaS", size: "500-1000", painPoints: ["Developer support demand", "Enterprise onboarding", "Integration troubleshooting"], products: "Internal tools platform" },
  { name: "Amplitude", website: "https://amplitude.com", industry: "SaaS", size: "500-1000", painPoints: ["Analytics support needs", "Implementation assistance", "Customer success scaling"], products: "Product analytics" },
  { name: "Mixpanel", website: "https://mixpanel.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support demand", "Implementation assistance", "Customer onboarding backlog"], products: "Product analytics" },
  { name: "Heap", website: "https://heap.io", industry: "SaaS", size: "500-1000", painPoints: ["Analytics support scaling", "Enterprise implementation", "Technical support needs"], products: "Digital insights platform" },
  { name: "Segment", website: "https://segment.com", industry: "SaaS", size: "500-1000", painPoints: ["Integration support demand", "Technical troubleshooting", "Enterprise onboarding"], products: "Customer data platform" },
  { name: "Braze", website: "https://braze.com", industry: "SaaS", size: "1000-5000", painPoints: ["Campaign support needs", "Technical implementation", "Customer success scaling"], products: "Customer engagement platform" },
  { name: "Iterable", website: "https://iterable.com", industry: "SaaS", size: "500-1000", painPoints: ["Campaign support demand", "Technical implementation", "Customer success needs"], products: "Marketing automation" },
  { name: "Customer.io", website: "https://customer.io", industry: "SaaS", size: "100-500", painPoints: ["Technical support scaling", "Integration troubleshooting", "Customer onboarding"], products: "Marketing automation" },
  { name: "Sendgrid (Twilio)", website: "https://sendgrid.com", industry: "SaaS", size: "1000-5000", painPoints: ["Deliverability support", "Technical troubleshooting", "Enterprise scaling support"], products: "Email delivery platform" },
  { name: "Mailchimp", website: "https://mailchimp.com", industry: "SaaS", size: "1000-5000", painPoints: ["SMB support volume", "Migration assistance", "Technical support demand"], products: "Email marketing platform" },
  { name: "Constant Contact", website: "https://constantcontact.com", industry: "SaaS", size: "1000-5000", painPoints: ["SMB customer service", "Onboarding support", "Technical assistance needs"], products: "Email and marketing" },
  { name: "ActiveCampaign", website: "https://activecampaign.com", industry: "SaaS", size: "500-1000", painPoints: ["Automation support demand", "Migration assistance", "Customer success scaling"], products: "Marketing automation" },
  { name: "Calendly", website: "https://calendly.com", industry: "SaaS", size: "500-1000", painPoints: ["Enterprise support scaling", "Integration troubleshooting", "Customer success needs"], products: "Scheduling software" },
  { name: "Loom", website: "https://loom.com", industry: "SaaS", size: "500-1000", painPoints: ["Support ticket volume", "Enterprise onboarding", "Technical assistance demand"], products: "Video messaging platform" },
  { name: "Descript", website: "https://descript.com", industry: "SaaS", size: "100-500", painPoints: ["Technical support needs", "Creator support scaling", "Feature request handling"], products: "Video and audio editing" },
  { name: "Riverside.fm", website: "https://riverside.fm", industry: "SaaS", size: "100-500", painPoints: ["Technical support demand", "Customer onboarding", "Feature support needs"], products: "Podcast recording platform" },
  { name: "Podium", website: "https://podium.com", industry: "SaaS", size: "1000-5000", painPoints: ["SMB customer support", "Onboarding assistance", "Technical support scaling"], products: "Business messaging platform" },
  { name: "Birdeye", website: "https://birdeye.com", industry: "SaaS", size: "500-1000", painPoints: ["Customer support demand", "Onboarding capacity", "Technical assistance needs"], products: "Reputation management" },
  { name: "Yotpo", website: "https://yotpo.com", industry: "SaaS", size: "500-1000", painPoints: ["E-commerce support scaling", "Implementation assistance", "Customer success needs"], products: "E-commerce marketing" },
  { name: "Attentive", website: "https://attentive.com", industry: "SaaS", size: "500-1000", painPoints: ["SMS campaign support", "Technical implementation", "Customer success scaling"], products: "SMS marketing platform" },
  { name: "Postscript", website: "https://postscript.io", industry: "SaaS", size: "100-500", painPoints: ["E-commerce support needs", "Campaign assistance", "Technical troubleshooting"], products: "SMS marketing for Shopify" },
  { name: "Gorgias", website: "https://gorgias.com", industry: "SaaS", size: "100-500", painPoints: ["E-commerce support", "Technical implementation", "Customer success capacity"], products: "E-commerce helpdesk" },
  { name: "Recharge", website: "https://rechargepayments.com", industry: "SaaS", size: "100-500", painPoints: ["Merchant support scaling", "Technical troubleshooting", "Migration assistance"], products: "Subscription payments" },
  { name: "Bold Commerce", website: "https://boldcommerce.com", industry: "SaaS", size: "100-500", painPoints: ["Merchant support needs", "Technical implementation", "App support demand"], products: "E-commerce apps" },
  { name: "Okendo", website: "https://okendo.io", industry: "SaaS", size: "100-500", painPoints: ["Merchant onboarding", "Technical support needs", "Customer success scaling"], products: "Customer marketing platform" },
  { name: "Privy", website: "https://privy.com", industry: "SaaS", size: "100-500", painPoints: ["E-commerce support demand", "Onboarding assistance", "Technical troubleshooting"], products: "E-commerce marketing" },
  { name: "Plivo", website: "https://plivo.com", industry: "SaaS", size: "500-1000", painPoints: ["Developer support scaling", "Technical troubleshooting", "Enterprise implementation"], products: "Communications API" },
  { name: "MessageBird", website: "https://messagebird.com", industry: "SaaS", size: "500-1000", painPoints: ["Global support coverage", "Developer support needs", "Enterprise onboarding"], products: "Communications platform" },
  { name: "Vonage", website: "https://vonage.com", industry: "SaaS", size: "1000-5000", painPoints: ["API support scaling", "Technical troubleshooting", "Enterprise support needs"], products: "Communications APIs" },
  { name: "Bandwidth Inc", website: "https://bandwidth.com", industry: "SaaS", size: "1000-5000", painPoints: ["Technical support demand", "Enterprise onboarding", "Carrier support needs"], products: "Communications platform" },
  { name: "RingCentral", website: "https://ringcentral.com", industry: "SaaS", size: "5000-10000", painPoints: ["Customer support volume", "Technical troubleshooting", "Enterprise implementation"], products: "Business communications" },
  { name: "Dialpad", website: "https://dialpad.com", industry: "SaaS", size: "1000-5000", painPoints: ["Support ticket growth", "Enterprise onboarding", "Technical assistance needs"], products: "AI communications" },
  { name: "Aircall", website: "https://aircall.io", industry: "SaaS", size: "500-1000", painPoints: ["Customer support scaling", "Integration troubleshooting", "Onboarding capacity"], products: "Cloud phone system" },
  { name: "JustCall", website: "https://justcall.io", industry: "SaaS", size: "100-500", painPoints: ["Support ticket volume", "Technical troubleshooting", "Customer onboarding"], products: "Cloud phone for sales" },
  { name: "Talkdesk", website: "https://talkdesk.com", industry: "SaaS", size: "1000-5000", painPoints: ["Enterprise support needs", "Technical implementation", "Customer success scaling"], products: "Contact center software" },
  { name: "Five9", website: "https://five9.com", industry: "SaaS", size: "1000-5000", painPoints: ["Enterprise implementation", "Technical support demand", "Customer success needs"], products: "Contact center cloud" },
  { name: "NICE inContact", website: "https://nice.com", industry: "SaaS", size: "5000-10000", painPoints: ["Enterprise support demand", "Technical implementation", "Global support coverage"], products: "Contact center platform" },
  { name: "Genesys", website: "https://genesys.com", industry: "SaaS", size: "5000-10000", painPoints: ["Enterprise implementation", "Technical support scaling", "Customer success needs"], products: "Customer experience platform" },
  { name: "Twilio Flex", website: "https://twilio.com/flex", industry: "SaaS", size: "5000-10000", painPoints: ["Developer support demand", "Implementation assistance", "Technical troubleshooting"], products: "Programmable contact center" },
  { name: "Datadog", website: "https://datadoghq.com", industry: "SaaS", size: "5000-10000", painPoints: ["Technical support scaling", "Enterprise onboarding", "Implementation assistance"], products: "Monitoring and analytics" },
  { name: "New Relic", website: "https://newrelic.com", industry: "SaaS", size: "1000-5000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer success scaling"], products: "Observability platform" },
  { name: "Splunk", website: "https://splunk.com", industry: "SaaS", size: "5000-10000", painPoints: ["Enterprise support needs", "Technical implementation", "Customer success capacity"], products: "Data platform" },
  { name: "Elastic", website: "https://elastic.co", industry: "SaaS", size: "1000-5000", painPoints: ["Technical support scaling", "Enterprise onboarding", "Implementation assistance"], products: "Search and observability" },
  { name: "Sumo Logic", website: "https://sumologic.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer success needs"], products: "Cloud SIEM" },
  { name: "PagerDuty", website: "https://pagerduty.com", industry: "SaaS", size: "1000-5000", painPoints: ["Technical support scaling", "Enterprise onboarding", "Customer success capacity"], products: "Operations platform" },
  { name: "OpsGenie", website: "https://opsgenie.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer onboarding"], products: "Incident management" },
  { name: "xMatters", website: "https://xmatters.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support scaling", "Enterprise implementation", "Customer success needs"], products: "Service reliability platform" },
  { name: "ServiceNow", website: "https://servicenow.com", industry: "SaaS", size: "10000+", painPoints: ["Implementation partner needs", "Technical support demand", "Customer success scaling"], products: "Digital workflow platform" },
  { name: "Atlassian", website: "https://atlassian.com", industry: "SaaS", size: "5000-10000", painPoints: ["Self-service support volume", "Technical troubleshooting", "Enterprise implementation"], products: "Team collaboration tools" },
  { name: "GitLab", website: "https://gitlab.com", industry: "SaaS", size: "1000-5000", painPoints: ["Technical support demand", "Enterprise onboarding", "Customer success scaling"], products: "DevOps platform" },
  { name: "GitHub", website: "https://github.com", industry: "SaaS", size: "1000-5000", painPoints: ["Developer support scaling", "Enterprise implementation", "Technical troubleshooting"], products: "Development platform" },
  { name: "CircleCI", website: "https://circleci.com", industry: "SaaS", size: "500-1000", painPoints: ["Developer support demand", "Technical troubleshooting", "Enterprise onboarding"], products: "CI/CD platform" },
  { name: "Travis CI", website: "https://travis-ci.com", industry: "SaaS", size: "100-500", painPoints: ["Technical support capacity", "Developer assistance", "Enterprise support needs"], products: "CI/CD platform" },
  { name: "Buildkite", website: "https://buildkite.com", industry: "SaaS", size: "100-500", painPoints: ["Technical support scaling", "Enterprise onboarding", "Customer success needs"], products: "CI/CD platform" },
  { name: "LaunchDarkly", website: "https://launchdarkly.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer success scaling"], products: "Feature management" },
  { name: "Split.io", website: "https://split.io", industry: "SaaS", size: "100-500", painPoints: ["Technical support needs", "Enterprise onboarding", "Customer success capacity"], products: "Feature delivery platform" },
  { name: "Optimizely", website: "https://optimizely.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer success scaling"], products: "Digital experience platform" },
  { name: "Unbounce", website: "https://unbounce.com", industry: "SaaS", size: "100-500", painPoints: ["SMB support volume", "Technical troubleshooting", "Customer onboarding"], products: "Landing page builder" },
  { name: "Instapage", website: "https://instapage.com", industry: "SaaS", size: "100-500", painPoints: ["Enterprise support needs", "Technical implementation", "Customer success capacity"], products: "Landing page platform" },
  { name: "Leadpages", website: "https://leadpages.com", industry: "SaaS", size: "100-500", painPoints: ["SMB support demand", "Technical troubleshooting", "Customer onboarding"], products: "Landing page software" },
  { name: "Typeform", website: "https://typeform.com", industry: "SaaS", size: "500-1000", painPoints: ["Customer support scaling", "Technical troubleshooting", "Enterprise onboarding"], products: "Form and survey platform" },
  { name: "SurveyMonkey", website: "https://surveymonkey.com", industry: "SaaS", size: "1000-5000", painPoints: ["SMB support volume", "Enterprise implementation", "Technical assistance needs"], products: "Survey platform" },
  { name: "Qualtrics", website: "https://qualtrics.com", industry: "SaaS", size: "5000-10000", painPoints: ["Enterprise implementation", "Technical support demand", "Customer success scaling"], products: "Experience management" },
  { name: "Medallia", website: "https://medallia.com", industry: "SaaS", size: "1000-5000", painPoints: ["Enterprise support needs", "Technical implementation", "Customer success capacity"], products: "Experience management" },
  { name: "UserTesting", website: "https://usertesting.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support scaling", "Enterprise onboarding", "Customer success needs"], products: "User research platform" },
  { name: "Hotjar", website: "https://hotjar.com", industry: "SaaS", size: "500-1000", painPoints: ["Self-service support volume", "Technical troubleshooting", "Customer onboarding"], products: "Behavior analytics" },
  { name: "Fullstory", website: "https://fullstory.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer success scaling"], products: "Digital experience analytics" },
  { name: "Pendo", website: "https://pendo.io", industry: "SaaS", size: "500-1000", painPoints: ["Technical support scaling", "Enterprise onboarding", "Customer success needs"], products: "Product experience platform" },
  { name: "Gainsight", website: "https://gainsight.com", industry: "SaaS", size: "500-1000", painPoints: ["Enterprise support needs", "Technical implementation", "Customer success capacity"], products: "Customer success platform" },
  { name: "ChurnZero", website: "https://churnzero.com", industry: "SaaS", size: "100-500", painPoints: ["Technical support demand", "Enterprise onboarding", "Customer success scaling"], products: "Customer success software" },
  { name: "Totango", website: "https://totango.com", industry: "SaaS", size: "100-500", painPoints: ["Technical support needs", "Enterprise implementation", "Customer success capacity"], products: "Customer success platform" },
  { name: "Vitally", website: "https://vitally.io", industry: "SaaS", size: "100-500", painPoints: ["Technical support scaling", "Enterprise onboarding", "Customer success needs"], products: "Customer success platform" },
  { name: "Outreach", website: "https://outreach.io", industry: "SaaS", size: "1000-5000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer success scaling"], products: "Sales engagement platform" },
  { name: "SalesLoft", website: "https://salesloft.com", industry: "SaaS", size: "1000-5000", painPoints: ["Technical support scaling", "Enterprise onboarding", "Customer success needs"], products: "Revenue workflow platform" },
  { name: "Gong.io", website: "https://gong.io", industry: "SaaS", size: "1000-5000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer success capacity"], products: "Revenue intelligence" },
  { name: "Chorus.ai", website: "https://chorus.ai", industry: "SaaS", size: "500-1000", painPoints: ["Technical support needs", "Enterprise onboarding", "Customer success scaling"], products: "Conversation intelligence" },
  { name: "6sense", website: "https://6sense.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support demand", "Enterprise implementation", "Customer success scaling"], products: "Revenue AI platform" },
  { name: "Demandbase", website: "https://demandbase.com", industry: "SaaS", size: "500-1000", painPoints: ["Technical support scaling", "Enterprise onboarding", "Customer success needs"], products: "ABM platform" },
  { name: "ZoomInfo", website: "https://zoominfo.com", industry: "SaaS", size: "5000-10000", painPoints: ["Customer support volume", "Technical troubleshooting", "Enterprise implementation"], products: "Sales intelligence" },
  { name: "Apollo.io", website: "https://apollo.io", industry: "SaaS", size: "500-1000", painPoints: ["Support ticket growth", "Technical troubleshooting", "Customer onboarding"], products: "Sales intelligence platform" },
  { name: "Lusha", website: "https://lusha.com", industry: "SaaS", size: "100-500", painPoints: ["Customer support scaling", "Technical assistance", "Enterprise onboarding"], products: "B2B contact data" },
  { name: "Clearbit", website: "https://clearbit.com", industry: "SaaS", size: "100-500", painPoints: ["Technical support demand", "Integration troubleshooting", "Customer success needs"], products: "Data enrichment" },
  { name: "LeadIQ", website: "https://leadiq.com", industry: "SaaS", size: "100-500", painPoints: ["Customer support scaling", "Technical troubleshooting", "Enterprise onboarding"], products: "Prospecting platform" },
  { name: "Cognism", website: "https://cognism.com", industry: "SaaS", size: "500-1000", painPoints: ["Customer support demand", "Technical assistance", "Enterprise implementation"], products: "Sales intelligence" },
  { name: "Seamless.AI", website: "https://seamless.ai", industry: "SaaS", size: "100-500", painPoints: ["Support ticket volume", "Technical troubleshooting", "Customer onboarding"], products: "Sales prospecting" },
  { name: "Hunter.io", website: "https://hunter.io", industry: "SaaS", size: "100-500", painPoints: ["Customer support scaling", "Technical assistance", "Feature request handling"], products: "Email finder" },
  { name: "Snov.io", website: "https://snov.io", industry: "SaaS", size: "100-500", painPoints: ["Customer support demand", "Technical troubleshooting", "Customer onboarding"], products: "Sales automation" },
  { name: "Reply.io", website: "https://reply.io", industry: "SaaS", size: "100-500", painPoints: ["Customer support scaling", "Technical assistance", "Feature request handling"], products: "Sales engagement" },
  { name: "Woodpecker", website: "https://woodpecker.co", industry: "SaaS", size: "100-500", painPoints: ["Customer support demand", "Technical troubleshooting", "Enterprise onboarding"], products: "Cold email software" },
  { name: "Mailshake", website: "https://mailshake.com", industry: "SaaS", size: "100-500", painPoints: ["Support ticket volume", "Technical assistance", "Customer onboarding"], products: "Sales engagement" },
  { name: "Lemlist", website: "https://lemlist.com", industry: "SaaS", size: "100-500", painPoints: ["Customer support scaling", "Technical troubleshooting", "Feature request handling"], products: "Email outreach" },
  { name: "ScratchPay", website: "https://scratchpay.com", industry: "FinTech", size: "100-500", painPoints: ["Customer support demand", "Provider support needs", "Application processing"], products: "Healthcare financing" },
  { name: "CareCredit", website: "https://carecredit.com", industry: "FinTech", size: "1000-5000", painPoints: ["Customer service volume", "Provider support scaling", "Application support"], products: "Healthcare financing" },
  { name: "Affirm", website: "https://affirm.com", industry: "FinTech", size: "1000-5000", painPoints: ["Customer support demand", "Merchant support scaling", "Dispute resolution"], products: "Buy now pay later" },
  { name: "Klarna", website: "https://klarna.com", industry: "FinTech", size: "5000-10000", painPoints: ["Global support coverage", "Merchant support needs", "Customer service volume"], products: "Buy now pay later" },
  { name: "Afterpay", website: "https://afterpay.com", industry: "FinTech", size: "1000-5000", painPoints: ["Customer support scaling", "Merchant onboarding", "Dispute handling"], products: "Buy now pay later" },
  { name: "Sezzle", website: "https://sezzle.com", industry: "FinTech", size: "500-1000", painPoints: ["Customer support demand", "Merchant support needs", "Payment assistance"], products: "Buy now pay later" },
  { name: "Zip (QuadPay)", website: "https://zip.co", industry: "FinTech", size: "500-1000", painPoints: ["Customer service volume", "Merchant support scaling", "Application support"], products: "Buy now pay later" },
  { name: "Splitit", website: "https://splitit.com", industry: "FinTech", size: "100-500", painPoints: ["Customer support needs", "Merchant onboarding", "Technical assistance"], products: "Installment payments" },
  { name: "PayPal Credit", website: "https://paypal.com", industry: "FinTech", size: "10000+", painPoints: ["Customer service volume", "Dispute resolution", "Technical support demand"], products: "Digital payments, credit" },
];

const CONTACT_TITLES = [
  "VP of Operations", "Director of Operations", "Chief Operating Officer", "VP of Customer Success",
  "Head of Customer Support", "Director of Customer Experience", "VP of People Operations", "Chief People Officer",
  "Director of HR", "VP of Finance", "Chief Financial Officer", "Controller",
  "VP of IT", "Chief Information Officer", "Director of Technology", "IT Director",
  "Head of Engineering", "VP of Product", "Director of Business Operations", "Operations Manager",
  "Director of Shared Services", "VP of Global Operations", "Head of Back Office", "Director of Process Excellence",
  "Chief Revenue Officer", "VP of Sales Operations", "Director of Business Development", "Head of Growth",
];

const FIRST_NAMES = [
  "James", "Sarah", "Michael", "Jennifer", "David", "Lisa", "Robert", "Emily", "William", "Amanda",
  "Christopher", "Michelle", "Matthew", "Jessica", "Daniel", "Nicole", "Andrew", "Stephanie", "Joshua", "Rebecca",
  "Ryan", "Laura", "Kevin", "Angela", "Brandon", "Melissa", "Justin", "Christina", "Tyler", "Amber",
  "Aaron", "Heather", "Nathan", "Kimberly", "Jacob", "Rachel", "Zachary", "Megan", "Ethan", "Ashley",
  "Nicholas", "Samantha", "Dylan", "Brittany", "Jonathan", "Danielle", "Austin", "Lauren", "Eric", "Courtney",
  "Mark", "Catherine", "Steven", "Elizabeth", "Brian", "Patricia", "Joseph", "Sandra", "Timothy", "Karen",
  "Thomas", "Nancy", "Gregory", "Betty", "Frank", "Margaret", "Raymond", "Dorothy", "Dennis", "Ruth",
  "Peter", "Helen", "Douglas", "Diane", "Henry", "Virginia", "Carl", "Marie", "Arthur", "Janet",
];

const LAST_NAMES = [
  "Thompson", "Mitchell", "Chen", "Williams", "Anderson", "Martinez", "Taylor", "Johnson", "Brown", "Davis",
  "Wilson", "Garcia", "Miller", "Moore", "Jackson", "White", "Harris", "Martin", "Lee", "Clark",
  "Lewis", "Robinson", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott", "Green",
  "Baker", "Adams", "Nelson", "Hill", "Campbell", "Carter", "Phillips", "Evans", "Turner", "Collins",
  "Edwards", "Stewart", "Morris", "Rogers", "Reed", "Cook", "Morgan", "Bell", "Murphy", "Bailey",
  "Rivera", "Cooper", "Richardson", "Cox", "Howard", "Ward", "Torres", "Peterson", "Gray", "Ramirez",
  "James", "Watson", "Brooks", "Kelly", "Sanders", "Price", "Bennett", "Wood", "Barnes", "Ross",
  "Henderson", "Coleman", "Jenkins", "Perry", "Powell", "Long", "Patterson", "Hughes", "Flores", "Washington",
];

const LEAD_STATUSES = ["new", "contacted", "qualified", "meeting-booked", "handed-off"];
const DISPOSITIONS = ["connected", "voicemail", "no-answer", "busy", "callback-scheduled", "not-interested", "qualified", "meeting-booked"];

// Comprehensive observations templates based on score and disposition
const OBSERVATION_TEMPLATES = {
  excellent: [
    "Demonstrated exceptional discovery skills by asking 5+ probing questions that uncovered the prospect's core pain points",
    "Built strong rapport immediately by referencing the prospect's recent company news and industry challenges",
    "Effectively navigated past the gatekeeper with confidence and professionalism",
    "Showed deep service knowledge when connecting BSA Solutions offerings to specific customer needs",
    "Handled the budget objection skillfully by shifting focus to ROI and total cost of ownership",
    "Used social proof effectively by mentioning similar companies in the prospect's industry",
    "Demonstrated active listening by accurately summarizing the prospect's concerns before responding",
    "Created urgency naturally by connecting to the prospect's stated timeline and business goals",
    "Transitioned smoothly from discovery to value proposition without being pushy",
    "Closed confidently for the next step with a clear, compelling reason to meet",
  ],
  good: [
    "Asked solid discovery questions but could have dug deeper on budget and decision-making process",
    "Built adequate rapport, though missed opportunity to personalize based on LinkedIn research",
    "Product positioning was good but relied heavily on features rather than business outcomes",
    "Handled initial resistance well but backed off too quickly when prospect hesitated",
    "Good energy and pacing throughout the call, maintained professional tone",
    "Identified key pain point but didn't fully explore the business impact",
    "Demonstrated knowledge of outsourcing benefits and common operational challenges",
    "Asked for the meeting but could have been more direct in setting a specific date/time",
    "Good follow-up on voicemail but could have added more value proposition",
    "Showed improvement in objection handling compared to previous calls",
  ],
  needsWork: [
    "Rushed through the opening without building rapport or qualifying interest",
    "Talked about product features too early before understanding prospect needs",
    "Missed multiple buying signals that could have advanced the conversation",
    "Didn't ask any questions about the decision-making process or timeline",
    "Lost control of the conversation when prospect started asking detailed technical questions",
    "Sounded scripted and didn't adapt to the prospect's specific situation",
    "Failed to address the competitor objection effectively, seemed caught off guard",
    "Didn't summarize next steps clearly, leaving the prospect confused about follow-up",
    "Spoke too quickly and didn't pause to let the prospect respond fully",
    "Gave up too easily after first objection without attempting to understand the concern",
  ],
};

const RECOMMENDATION_TEMPLATES = {
  discovery: [
    "Practice the SPIN questioning technique - focus on Situation, Problem, Implication, and Need-payoff questions",
    "Prepare 3-5 industry-specific pain point questions before each call",
    "When prospect mentions a challenge, use 'Tell me more about that' to dig deeper",
    "Ask about the business impact: 'How does this affect your timeline/budget/team?'",
    "Qualify budget early: 'What has the company invested in similar solutions before?'",
  ],
  objectionHandling: [
    "Use the LAER framework: Listen, Acknowledge, Explore, Respond when handling objections",
    "Prepare responses for the top 5 objections: offshore concerns, timing, competitor BPO, authority, need",
    "When prospect says 'not interested,' ask: 'What would need to change for this to be relevant?'",
    "Practice the feel-felt-found technique for empathetic objection handling",
    "Don't argue - instead, ask questions to understand the real concern behind the objection",
  ],
  closing: [
    "Always assume the sale - use assumptive closes like 'Would Tuesday or Thursday work better?'",
    "Create urgency by connecting to their stated timeline and business goals",
    "Summarize value received before asking for the meeting",
    "Use the alternative close: offer two meeting times instead of asking yes/no",
    "If prospect hesitates, offer a low-commitment next step like a brief demo or case study",
  ],
  rapport: [
    "Research the prospect on LinkedIn before calling - mention something specific",
    "Reference recent company news or industry trends to show you've done your homework",
    "Mirror the prospect's pace and energy level to build connection",
    "Find common ground early - industry experience, shared connections, or mutual interests",
    "Use the prospect's name 2-3 times during the call to personalize the conversation",
  ],
  valueProposition: [
    "Lead with business outcomes, not product features - ROI, time savings, quality improvement",
    "Use customer success stories from similar companies in their industry",
    "Quantify the value: 'Companies like yours typically see X% reduction in design time'",
    "Connect BSA Solutions services directly to the operational pain points they mentioned",
    "Prepare an elevator pitch that's 30 seconds or less and focuses on customer benefits",
  ],
};

const CRITERIA_MET_TEMPLATES = {
  opening: [
    { met: true, criterion: "Professional greeting and introduction", detail: "Clearly stated name and company within first 10 seconds" },
    { met: true, criterion: "Permission-based approach", detail: "Asked if it was a good time before diving in" },
    { met: false, criterion: "Value statement in opening", detail: "Missed opportunity to lead with a compelling reason for the call" },
    { met: true, criterion: "Reference to prior research", detail: "Mentioned company news or industry context" },
  ],
  discovery: [
    { met: true, criterion: "Identified primary pain point", detail: "Successfully uncovered main challenge within first 3 minutes" },
    { met: true, criterion: "Asked about business impact", detail: "Explored how the problem affects revenue/timeline/team" },
    { met: false, criterion: "Budget qualification", detail: "Did not ask about budget or previous investment in solutions" },
    { met: true, criterion: "Decision-maker identification", detail: "Confirmed who else is involved in the decision" },
    { met: false, criterion: "Timeline exploration", detail: "Did not establish urgency or implementation timeline" },
    { met: true, criterion: "Competition awareness", detail: "Asked what other solutions they're considering" },
  ],
  presentation: [
    { met: true, criterion: "Solution matched to pain points", detail: "Connected BSA Solutions services to stated challenges" },
    { met: true, criterion: "Used customer proof points", detail: "Referenced similar customers or case studies" },
    { met: false, criterion: "Quantified ROI", detail: "Did not provide specific ROI numbers or benchmarks" },
    { met: true, criterion: "Avoided feature dumping", detail: "Focused on relevant capabilities only" },
  ],
  closing: [
    { met: true, criterion: "Clear call-to-action", detail: "Asked for specific next step with defined timeline" },
    { met: true, criterion: "Handled final objections", detail: "Addressed last-minute concerns before closing" },
    { met: false, criterion: "Set specific meeting time", detail: "Left follow-up vague instead of booking on the call" },
    { met: true, criterion: "Confirmed contact information", detail: "Verified email and phone for follow-up" },
  ],
  compliance: [
    { met: true, criterion: "DNC compliance", detail: "Verified number is not on do-not-call list" },
    { met: true, criterion: "Professional language", detail: "Maintained appropriate business communication" },
    { met: true, criterion: "Accurate product claims", detail: "Did not make exaggerated or false statements" },
    { met: true, criterion: "Proper call recording disclosure", detail: "Informed prospect call may be recorded" },
  ],
};

const OBSERVATION_CATEGORIES = ["Opening", "Discovery", "Objection Handling", "Value Proposition", "Closing", "Rapport", "Listening", "Product Knowledge"];

function generateDetailedObservations(score: number, disposition: string, sdrName: string): string {
  const observations: { category: string; observation: string; quote?: string }[] = [];
  
  const quotes = [
    "I completely understand your concern about offshore operations...",
    "Tell me more about how that affects your team...",
    "Based on what you've shared, I think BSA Solutions could help by...",
    "What would need to happen for you to move forward?",
    "Other companies in your industry have seen 60% cost savings...",
    "It sounds like scaling your support team is really challenging...",
    "If we could solve that problem, what would that mean for your Q2 goals?",
  ];
  
  if (score >= 8) {
    const excellent = randomItems(OBSERVATION_TEMPLATES.excellent, 4);
    excellent.forEach((obs, i) => {
      observations.push({
        category: randomItem(OBSERVATION_CATEGORIES),
        observation: obs,
        quote: i < 2 ? randomItem(quotes) : undefined,
      });
    });
    observations.push({
      category: randomItem(OBSERVATION_CATEGORIES),
      observation: randomItem(OBSERVATION_TEMPLATES.good),
    });
  } else if (score >= 6) {
    const good = randomItems(OBSERVATION_TEMPLATES.good, 3);
    good.forEach((obs, i) => {
      observations.push({
        category: randomItem(OBSERVATION_CATEGORIES),
        observation: obs,
        quote: i === 0 ? randomItem(quotes) : undefined,
      });
    });
    observations.push({
      category: randomItem(OBSERVATION_CATEGORIES),
      observation: randomItem(OBSERVATION_TEMPLATES.excellent),
      quote: randomItem(quotes),
    });
    observations.push({
      category: randomItem(OBSERVATION_CATEGORIES),
      observation: randomItem(OBSERVATION_TEMPLATES.needsWork),
    });
  } else {
    const needsWork = randomItems(OBSERVATION_TEMPLATES.needsWork, 3);
    needsWork.forEach(obs => {
      observations.push({
        category: randomItem(OBSERVATION_CATEGORIES),
        observation: obs,
      });
    });
    observations.push({
      category: randomItem(OBSERVATION_CATEGORIES),
      observation: randomItem(OBSERVATION_TEMPLATES.good),
      quote: randomItem(quotes),
    });
  }
  
  // Add disposition-specific observation
  if (disposition === "meeting-booked") {
    observations.push({
      category: "Closing",
      observation: "Successfully converted the conversation to a scheduled demo, demonstrating strong closing skills",
      quote: "How about we set up a 30-minute demo next Tuesday at 2pm?",
    });
  } else if (disposition === "qualified") {
    observations.push({
      category: "Qualification",
      observation: "Effectively qualified the opportunity, identifying clear next steps and decision criteria",
    });
  } else if (disposition === "callback-scheduled") {
    observations.push({
      category: "Follow-up",
      observation: "Secured commitment for a follow-up call, maintaining momentum in the sales process",
    });
  } else if (disposition === "not-interested") {
    observations.push({
      category: "Qualification",
      observation: "Prospect declined - consider whether earlier qualification could have saved time",
    });
  }
  
  return JSON.stringify(observations);
}

function generateDetailedRecommendations(score: number, openingScore: number, discoveryScore: number, objectionScore: number, closingScore: number, valueScore: number): string {
  const recommendations: { priority: string; recommendation: string; action: string }[] = [];
  
  // Add recommendations based on weakest areas
  const scores = [
    { area: "Discovery", score: discoveryScore, templates: RECOMMENDATION_TEMPLATES.discovery },
    { area: "Objection Handling", score: objectionScore, templates: RECOMMENDATION_TEMPLATES.objectionHandling },
    { area: "Closing", score: closingScore, templates: RECOMMENDATION_TEMPLATES.closing },
    { area: "Rapport Building", score: openingScore, templates: RECOMMENDATION_TEMPLATES.rapport },
    { area: "Value Proposition", score: valueScore, templates: RECOMMENDATION_TEMPLATES.valueProposition },
  ];
  
  // Sort by score (lowest first) to prioritize areas needing most work
  scores.sort((a, b) => a.score - b.score);
  
  // Get recommendations from weakest areas with priorities
  const weakestRecs = randomItems(scores[0].templates, 2);
  weakestRecs.forEach(rec => {
    recommendations.push({
      priority: "high",
      recommendation: rec,
      action: `Focus on ${scores[0].area.toLowerCase()} techniques in next 3 calls`,
    });
  });
  
  recommendations.push({
    priority: "medium",
    recommendation: randomItem(scores[1].templates),
    action: `Practice ${scores[1].area.toLowerCase()} skills in role-play session`,
  });
  
  // Add coaching suggestion based on overall score
  if (score >= 8) {
    recommendations.push({
      priority: "low",
      recommendation: "Consider shadowing newer team members to share your successful techniques",
      action: "Schedule a peer coaching session this week",
    });
    recommendations.push({
      priority: "low",
      recommendation: "Document your most effective talk tracks for the team playbook",
      action: "Submit 2-3 successful talk tracks to the team knowledge base",
    });
  } else if (score >= 6) {
    recommendations.push({
      priority: "medium",
      recommendation: "Schedule a role-play session focusing on the areas identified above",
      action: "Book 30-min role-play with manager before Friday",
    });
    recommendations.push({
      priority: "low",
      recommendation: "Listen to recordings of top performers handling similar call types",
      action: "Review 3 call recordings from top SDRs this week",
    });
  } else {
    recommendations.push({
      priority: "high",
      recommendation: "Mandatory coaching session scheduled to review call techniques",
      action: "1:1 coaching session with manager - scheduled for this week",
    });
    recommendations.push({
      priority: "high",
      recommendation: "Complete the online training module on consultative selling basics",
      action: "Complete training module within 48 hours",
    });
    recommendations.push({
      priority: "medium",
      recommendation: "Shadow a senior SDR for at least 3 calls this week",
      action: "Coordinate with team lead to schedule shadowing sessions",
    });
  }
  
  return JSON.stringify(recommendations);
}

function generateCriteriaMet(openingScore: number, discoveryScore: number, valueScore: number, closingScore: number, complianceScore: number): string {
  const criteria: { criterion: string; status: string; notes: string }[] = [];
  
  // Helper to determine status based on score and randomness
  const getStatus = (score: number): string => {
    if (score >= 9) return Math.random() > 0.3 ? "exceeded" : "met";
    if (score >= 7) return Math.random() > 0.2 ? "met" : "missed";
    if (score >= 5) return Math.random() > 0.5 ? "met" : "missed";
    return Math.random() > 0.7 ? "met" : "missed";
  };
  
  // Opening criteria
  CRITERIA_MET_TEMPLATES.opening.forEach(c => {
    const status = getStatus(openingScore);
    criteria.push({
      criterion: c.criterion,
      status: status,
      notes: status === "missed" ? `Needs improvement: ${c.detail}` : c.detail,
    });
  });
  
  // Discovery criteria  
  CRITERIA_MET_TEMPLATES.discovery.forEach(c => {
    const status = getStatus(discoveryScore);
    criteria.push({
      criterion: c.criterion,
      status: status,
      notes: status === "missed" ? `Opportunity missed: ${c.detail}` : c.detail,
    });
  });
  
  // Value proposition criteria
  CRITERIA_MET_TEMPLATES.presentation.forEach(c => {
    const status = getStatus(valueScore);
    criteria.push({
      criterion: c.criterion,
      status: status,
      notes: status === "exceeded" ? `Excellent: ${c.detail}` : c.detail,
    });
  });
  
  // Closing criteria
  CRITERIA_MET_TEMPLATES.closing.forEach(c => {
    const status = getStatus(closingScore);
    criteria.push({
      criterion: c.criterion,
      status: status,
      notes: c.detail,
    });
  });
  
  // Compliance criteria (usually all met)
  CRITERIA_MET_TEMPLATES.compliance.forEach(c => {
    const status = complianceScore >= 8 ? "met" : "missed";
    criteria.push({
      criterion: c.criterion,
      status: status,
      notes: c.detail,
    });
  });
  
  return JSON.stringify(criteria);
}

function randomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  date.setHours(randomInt(8, 18), randomInt(0, 59), 0, 0);
  return date;
}

function recentDate(hoursAgo: number): Date {
  const date = new Date();
  date.setTime(date.getTime() - Math.floor(Math.random() * hoursAgo * 60 * 60 * 1000));
  return date;
}

function dateInLastWeek(): Date {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, 6));
  date.setHours(randomInt(8, 18), randomInt(0, 59), 0, 0);
  return date;
}

function generateTranscript(contactName: string, companyName: string, outcome: string, painPoints: string[]): string {
  const sdrName = "SDR";
  const painPoint = painPoints[0] || "scaling operational challenges";

  const intros = [
    `${sdrName}: Hi ${contactName}, this is calling from BSA Solutions. I noticed ${companyName} has been expanding operations. Do you have a moment to discuss how we help companies scale their teams?`,
    `${sdrName}: Good morning ${contactName}, I'm reaching out from BSA Solutions. We work with many companies in your industry on talent outsourcing. Is this a good time?`,
    `${sdrName}: Hello ${contactName}, hope I'm not catching you at a bad time. I wanted to connect about how ${companyName} is handling ${painPoint}?`,
  ];
  
  const discoveries = [
    `${contactName}: Actually, yes. We've been struggling with ${painPoint}. It's been causing delays in our operations.
${sdrName}: I hear that a lot from operations leaders. Can you tell me more about the specific challenges you're facing?
${contactName}: Well, our current team is stretched thin, and we're finding it hard to scale during peak periods.
${sdrName}: That's a common issue. How many support agents or back-office staff do you currently have?
${contactName}: We have about 45 people across customer support and operations. The hiring and training costs have become a nightmare.`,
    `${contactName}: Yes, actually. We're evaluating different outsourcing solutions right now.
${sdrName}: Perfect timing then. What's driving the evaluation?
${contactName}: Mainly ${painPoint}. Our current in-house team just can't keep up with demand.
${sdrName}: I understand. What specific capabilities are you looking for in an outsourcing partner?
${contactName}: Quality talent, definitely. And we need 24/7 coverage with good English skills.`,
    `${contactName}: We're actually working with another BPO, but I'm always interested in learning about alternatives.
${sdrName}: I appreciate that. How is that relationship working out?
${contactName}: It's okay, but there are some quality issues. We might be open to a change.
${sdrName}: That makes sense. What would make you consider switching to a new partner?
${contactName}: Better talent quality and more flexibility. Our ${painPoint} is really hurting our customer satisfaction scores.`,
  ];
  
  const qualifications = {
    qualified: `${sdrName}: Based on what you've shared, it sounds like BSA Solutions could address these challenges. We have several customers in your industry who saw 60% cost savings while improving quality after partnering with us.
${contactName}: That would be significant for us. What would be the next steps?
${sdrName}: I'd recommend a discovery call where our solutions team evaluates your specific operational needs. Would that be valuable?
${contactName}: Yes, let's do that. I can also loop in our VP of Operations and HR director.
${sdrName}: Perfect. I'll send over some preliminary information and set up a call with our team.`,
    "meeting-booked": `${sdrName}: Given your timeline and the challenges you've outlined, I think a personalized consultation would be really valuable. Our solutions team can show exactly how BSA Solutions handles ${painPoint}.
${contactName}: That sounds good. When can we schedule that?
${sdrName}: How does next Tuesday at 2 PM work for you? We can do a 45-minute session.
${contactName}: Let me check... yes, that works. Send me a calendar invite.
${sdrName}: Excellent! I'll include a brief agenda. Who else should I invite from your team?
${contactName}: Add our operations manager, Mike Stevens, and Sarah from HR.`,
    connected: `${sdrName}: I really appreciate you taking the time today, ${contactName}. It sounds like there's definitely some alignment here.
${contactName}: Yes, thanks for the call. Send me some information and I'll review it with my team.
${sdrName}: Absolutely. I'll send over a case study from a similar company in your industry. Can I follow up next week to see if you have questions?
${contactName}: Sure, early next week would be fine.`,
    "not-interested": `${contactName}: Look, we just signed a 3-year agreement with another BPO last quarter. There's really no point in continuing this conversation.
${sdrName}: I completely understand. Timing is everything. Would it be alright if I checked back in about 2 years as you approach renewal?
${contactName}: That's fine, but I can't promise we'll be interested.
${sdrName}: I appreciate your honesty. Things change, and we'll be here if you ever need alternatives.`,
    voicemail: `${sdrName}: Hi ${contactName}, this is calling from BSA Solutions. I work with operations teams at companies like ${companyName} on talent outsourcing solutions. I'd love to discuss how we're helping companies address ${painPoint}. Please give me a call back at your convenience, or I'll try you again later this week.`,
  };
  
  const outcomeKey = outcome === "meeting-booked" ? "meeting-booked" : 
                     outcome === "qualified" ? "qualified" :
                     outcome === "not-interested" ? "not-interested" :
                     outcome === "voicemail" ? "voicemail" : "connected";
  
  if (outcomeKey === "voicemail") {
    return qualifications.voicemail;
  }
  
  return `${randomItem(intros)}\n\n${randomItem(discoveries)}\n\n${qualifications[outcomeKey]}`;
}

function generateCoachingAnalysis(score: number, disposition: string): string {
  const strengths = [
    "Strong opening with clear value proposition and company research",
    "Excellent rapport building through industry-specific knowledge",
    "Effective use of open-ended discovery questions",
    "Professional tone maintained throughout the call",
    "Demonstrated deep service knowledge and competitive positioning",
    "Handled objections with confidence and relevant examples",
    "Active listening skills evident through follow-up questions",
    "Clear next steps established with specific timeline",
    "Good use of customer success stories to build credibility",
    "Effectively uncovered budget and decision-making process",
  ];

  const improvements = [
    "Could ask more discovery questions before presenting solutions",
    "Consider slowing down the pace to allow prospect to elaborate",
    "More focus needed on identifying specific operational pain points",
    "Better qualification of decision-making authority recommended",
    "Stronger transition to closing could improve conversion",
    "More personalization based on pre-call research would help",
    "Value articulation could be more specific to prospect's industry",
    "Better handling of silence/pauses to encourage prospect sharing",
    "Consider deeper exploration of current outsourcing situation",
    "More emphasis on cost savings and quality improvement would strengthen pitch",
  ];

  const actions = [
    "Practice discovery question techniques using SPIN methodology",
    "Review objection handling playbook for offshore concerns",
    "Study competitor differentiation points vs TaskUs and Teleperformance",
    "Work on call opening variations for different industries",
    "Improve closing statement delivery with specific CTAs",
    "Focus on BANT qualification in first 5 minutes",
    "Practice handling 'we've had bad BPO experiences' objection",
    "Develop industry-specific case study references",
  ];
  
  const bantAssessment = {
    budget: disposition === "meeting-booked" || disposition === "qualified" ?
      { status: "identified", details: "Prospect confirmed budget allocation for Q2" } :
      { status: "unknown", details: "Budget not discussed in this call" },
    authority: disposition === "meeting-booked" ?
      { status: "confirmed", details: "VP-level decision maker with final approval authority" } :
      { status: "partial", details: "Operations influencer, need to identify economic buyer" },
    need: { status: "confirmed", details: "Clear pain points around operational scaling challenges" },
    timeline: disposition === "meeting-booked" ?
      { status: "defined", details: "Looking to implement by end of Q2" } :
      { status: "exploratory", details: "No specific timeline established" },
  };
  
  const analysis = {
    overallScore: score,
    callSummary: `The SDR demonstrated ${score >= 8 ? "excellent" : score >= 6 ? "solid" : "developing"} sales skills during this ${disposition === "meeting-booked" ? "successful meeting-booking call" : disposition === "qualified" ? "qualifying call" : "prospecting call"}. ${score >= 7 ? "Strong discovery and value articulation led to positive outcome." : "Room for improvement on key qualifying metrics."}`,
    strengths: strengths.slice(0, randomInt(3, 5)),
    areasForImprovement: improvements.slice(0, randomInt(2, 4)),
    talkListenRatio: {
      sdrTalkTime: randomInt(35, 55),
      prospectTalkTime: randomInt(45, 65),
      notes: score >= 7 ? "Excellent balance with prospect doing most of the talking" : "Consider letting the prospect speak more to uncover needs"
    },
    questionQuality: {
      openEnded: randomInt(5, 10),
      closedEnded: randomInt(2, 5),
      score: Math.min(10, randomInt(score - 1, score + 1)),
      notes: "Good use of open-ended discovery questions. Consider adding more situation and implication questions."
    },
    objectionHandling: {
      objections: ["Pricing concern", "Happy with current vendor", "Need to check with team", "Budget timing"].slice(0, randomInt(1, 3)),
      score: Math.min(10, randomInt(score - 1, score + 2)),
      notes: score >= 7 ? "Objections handled professionally with relevant examples" : "Practice turning objections into opportunities for deeper discovery"
    },
    bantAssessment,
    recommendedActions: actions.slice(0, randomInt(2, 4)),
    nextSteps: disposition === "meeting-booked" ? ["Demo scheduled with solutions engineer", "Send calendar invite with agenda", "Prepare industry-specific presentation"] :
               disposition === "qualified" ? ["Send ROI case study", "Schedule technical assessment call", "Research additional stakeholders"] :
               disposition === "callback-scheduled" ? ["Follow up as scheduled", "Prepare new value proposition angle", "Research recent company news"] :
               ["Send introduction email", "Research company further", "Plan follow-up approach"]
  };
  
  return JSON.stringify(analysis);
}

async function seedDemoData() {
  console.log("🌱 Starting comprehensive demo data seed...\n");
  
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  
  console.log("📝 Creating managers...");
  const createdManagers: { id: string; email: string }[] = [];
  for (const manager of MANAGER_DATA) {
    const [created] = await db.insert(managers).values({
      name: manager.name,
      email: manager.email,
      phone: manager.phone,
      title: manager.title,
      bio: manager.bio,
      coachingStyle: manager.coachingStyle,
      specialties: manager.specialties,
      yearsExperience: manager.yearsExperience,
      certifications: manager.certifications,
    }).onConflictDoNothing().returning();
    
    if (created) {
      createdManagers.push({ id: created.id, email: created.email });
      
      await db.insert(users).values({
        email: manager.email,
        password: hashedPassword,
        name: manager.name,
        role: "manager",
        managerId: created.id,
      }).onConflictDoNothing();
    } else {
      const existing = await db.select().from(managers).where(sql`email = ${manager.email}`).limit(1);
      if (existing[0]) createdManagers.push({ id: existing[0].id, email: existing[0].email });
    }
  }
  console.log(`   ✅ Created ${createdManagers.length} managers\n`);
  
  console.log("👥 Creating SDRs...");
  const createdSdrs: { id: string; name: string; managerId: string }[] = [];
  for (let i = 0; i < SDR_DATA.length; i++) {
    const sdr = SDR_DATA[i];
    const manager = createdManagers[i % createdManagers.length];
    const sdrId = `sdr_${sdr.email.split("@")[0].replace(".", "_")}`;
    
    const [created] = await db.insert(sdrs).values({
      id: sdrId,
      name: sdr.name,
      email: sdr.email,
      managerEmail: manager.email,
      managerId: manager.id,
      gender: sdr.gender,
      timezone: "America/Los_Angeles",
      bio: sdr.bio,
      strengths: sdr.strengths,
      developmentAreas: sdr.developmentAreas,
      goals: sdr.goals,
      yearsExperience: sdr.yearsExperience,
      previousCompany: sdr.previousCompany,
      specialties: sdr.specialties,
    }).onConflictDoNothing().returning();
    
    if (created) {
      createdSdrs.push({ id: created.id, name: created.name, managerId: manager.id });
      
      await db.insert(users).values({
        email: sdr.email,
        password: hashedPassword,
        name: sdr.name,
        role: "sdr",
        sdrId: created.id,
      }).onConflictDoNothing();
    } else {
      const existing = await db.select().from(sdrs).where(sql`id = ${sdrId}`).limit(1);
      if (existing[0]) createdSdrs.push({ id: existing[0].id, name: existing[0].name, managerId: manager.id });
    }
  }
  console.log(`   ✅ Created ${createdSdrs.length} SDRs\n`);
  
  console.log("💼 Creating Account Executives...");
  const createdAEs: { id: string }[] = [];
  for (const ae of AE_DATA) {
    const [created] = await db.insert(accountExecutives).values({
      name: ae.name,
      email: ae.email,
      region: ae.region,
      specialty: ae.specialty,
      phone: ae.phone,
      title: ae.title,
      bio: ae.bio,
      dealFocus: ae.dealFocus,
      yearsExperience: ae.yearsExperience,
      quotaAttainment: ae.quotaAttainment,
      avgDealSize: ae.avgDealSize,
    }).onConflictDoNothing().returning();
    
    if (created) {
      createdAEs.push({ id: created.id });
      
      await db.insert(users).values({
        email: ae.email,
        password: hashedPassword,
        name: ae.name,
        role: "account_specialist",
        accountSpecialistId: created.id,
      }).onConflictDoNothing();
    } else {
      const existing = await db.select().from(accountExecutives).where(sql`email = ${ae.email}`).limit(1);
      if (existing[0]) createdAEs.push({ id: existing[0].id });
    }
  }
  console.log(`   ✅ Created ${createdAEs.length} Account Executives\n`);
  
  console.log("🎯 Creating leads with detailed research...");
  const createdLeads: { id: string; companyName: string; contactName: string; sdrId: string; painPoints: string[] }[] = [];
  
  const companiesPerStatus: Record<string, number> = {
    new: 40,
    contacted: 50,
    qualified: 45,
    "meeting-booked": 30,
    "handed-off": 20,
  };
  
  let companyIndex = 0;
  for (const [status, count] of Object.entries(companiesPerStatus)) {
    for (let i = 0; i < count && companyIndex < REAL_COMPANIES.length; i++) {
      const company = REAL_COMPANIES[companyIndex];
      const firstName = randomItem(FIRST_NAMES);
      const lastName = randomItem(LAST_NAMES);
      const contactName = `${firstName} ${lastName}`;
      const sdr = createdSdrs[companyIndex % createdSdrs.length];
      const ae = status === "handed-off" ? randomItem(createdAEs) : null;
      const fitScore = status === "handed-off" ? randomInt(75, 95) :
                       status === "meeting-booked" ? randomInt(70, 90) :
                       status === "qualified" ? randomInt(60, 85) :
                       randomInt(30, 80);
      const priority = fitScore >= 80 ? "hot" : fitScore >= 60 ? "warm" : fitScore >= 40 ? "cool" : "cold";
      
      const emailDomain = company.website.replace("https://", "").replace("http://", "");
      
      const [lead] = await db.insert(leads).values({
        companyName: company.name,
        companyWebsite: company.website,
        companyIndustry: company.industry,
        companySize: company.size,
        contactName: contactName,
        contactTitle: randomItem(CONTACT_TITLES),
        contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`,
        contactPhone: `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`,
        source: randomItem(["manual", "google_sheets", "salesforce", "referral", "website", "linkedin"]),
        status: status,
        fitScore: fitScore,
        priority: priority,
        assignedSdrId: sdr.id,
        assignedAeId: ae?.id || null,
        qualificationNotes: status !== "new" ? `${company.painPoints[0]}. ${status === "qualified" ? "Strong buying signals, technical evaluation planned." : status === "meeting-booked" ? "Demo scheduled, multiple stakeholders involved." : status === "handed-off" ? "Qualified opportunity, ready for AE engagement." : "Initial contact made, follow-up required."}` : null,
        budget: status === "qualified" || status === "meeting-booked" || status === "handed-off" ? randomItem(["$50k-100k", "$100k-250k", "$250k-500k", "$500k+", "$1M+"]) : null,
        timeline: status !== "new" ? randomItem(["Q1 2026", "Q2 2026", "H2 2026", "Next 6 months", "Evaluating", "FY27 Budget"]) : null,
        handedOffAt: status === "handed-off" ? randomDate(30) : null,
        lastContactedAt: status !== "new" ? (status === "contacted" ? dateInLastWeek() : randomDate(14)) : null,
      }).returning();
      
      if (lead) {
        createdLeads.push({ 
          id: lead.id, 
          companyName: company.name, 
          contactName: contactName,
          sdrId: sdr.id,
          painPoints: company.painPoints,
        });
        
        await db.insert(researchPackets).values({
          leadId: lead.id,
          companyIntel: `${company.name} is a ${company.size} employee ${company.industry} company. ${company.products}. They are a market leader with strong growth trajectory and significant investment in technology and operations. Recent news includes expansion initiatives and scaling customer operations.`,
          contactIntel: `${contactName} has been with ${company.name} for ${randomInt(3, 15)} years in increasingly senior operations leadership roles. Background includes experience with operational scaling and team management. Active on LinkedIn with ${randomInt(800, 8000)} connections. Known for driving operational excellence and process improvement initiatives.`,
          painSignals: company.painPoints.map(p => `- ${p}`).join("\n"),
          competitorPresence: `Currently using ${randomItem(["in-house team only", "TaskUs", "Teleperformance", "Concentrix", "Alorica", "no outsourcing partner"])}. ${randomItem(["Some concerns about quality and turnover.", "Looking to diversify outsourcing partners.", "Evaluating alternatives for better cost structure.", "Frustrated with current provider's flexibility."])}`,
          fitAnalysis: `Strong fit for BSA Solutions ${company.industry.includes("E-Commerce") || company.industry.includes("SaaS") ? "Customer Support Team with 24/7 coverage" : company.industry.includes("Healthcare") ? "Back Office and Claims Processing" : company.industry.includes("FinTech") ? "Technical Support and Compliance" : "Dedicated Operations Team"}. ${company.size.includes("10000") ? "Enterprise-level engagement" : company.size.includes("5000") ? "Large team deployment" : "Mid-market starter team"} with budget alignment for ${priority === "hot" ? "immediate pilot" : priority === "warm" ? "Q1-Q2 decision" : "long-term nurturing"}.`,
          fitScore: fitScore,
          priority: priority,
          talkTrack: `Opening: "Hi ${contactName}, I noticed ${company.name} has been ${randomItem(["scaling operations", "investing in customer experience", "expanding their team"])}. Many ${company.industry} companies are finding that ${company.painPoints[0]}..."\n\nValue Prop: Focus on ${company.industry}-specific cost savings and quality improvements. Reference similar customers like ${randomItem(["Shopify Plus", "Klaviyo", "Zendesk", "Oscar Health", "Stripe"])} success stories.\n\nCall to Action: Offer a ${randomItem(["discovery consultation", "personalized assessment", "operations review"])}.`,
          discoveryQuestions: `1. How are you currently handling customer support and back-office operations?\n2. How many people do you have on your operations team today?\n3. What's your biggest challenge with ${company.painPoints[0]}?\n4. Are you working with any outsourcing partners currently?\n5. Who else would be involved in evaluating a new outsourcing partner?\n6. What's your timeline for making improvements to your operations?`,
          objectionHandles: `Offshore Concerns: "I completely understand the hesitation. Our Philippines team has 95% English proficiency and strong cultural alignment with Western businesses..."\nTiming: "I completely understand. Many of our customers started with a small pilot of 3-5 agents before scaling up..."\nCompetitor: "That's a solid provider too. The key differentiator for ${company.industry} companies is our ${randomItem(["talent quality", "flexibility to scale", "Great Place to Work certified culture"])}..."`,
          verificationStatus: "verified",
        }).onConflictDoNothing();
      }
      
      companyIndex++;
    }
  }
  console.log(`   ✅ Created ${createdLeads.length} leads with research packets\n`);
  
  console.log("📞 Creating call sessions (20+ per SDR with recent focus)...");
  let callCount = 0;
  let recentCallCount = 0;
  
  const userRecords = await db.select().from(users).where(sql`role = 'sdr'`);
  
  for (const sdr of createdSdrs) {
    const sdrUser = userRecords.find(u => u.sdrId === sdr.id);
    if (!sdrUser) continue;
    
    const sdrLeads = createdLeads.filter(l => l.sdrId === sdr.id);
    const callsPerSdr = randomInt(22, 28);
    
    for (let i = 0; i < callsPerSdr; i++) {
      const lead = sdrLeads[i % sdrLeads.length] || randomItem(createdLeads);
      
      let callDate: Date;
      if (i < 3) {
        callDate = recentDate(24);
        recentCallCount++;
      } else if (i < 8) {
        callDate = dateInLastWeek();
        recentCallCount++;
      } else {
        callDate = randomDate(45);
      }
      
      const disposition = i < 5 ? randomItem(["connected", "qualified", "meeting-booked", "callback-scheduled"]) : randomItem(DISPOSITIONS);
      const duration = disposition === "voicemail" ? randomInt(20, 45) : 
                       disposition === "no-answer" ? 0 :
                       disposition === "meeting-booked" ? randomInt(480, 900) :
                       disposition === "qualified" ? randomInt(360, 720) :
                       disposition === "connected" ? randomInt(180, 480) :
                       randomInt(60, 300);
      const score = disposition === "meeting-booked" ? randomInt(8, 10) :
                    disposition === "qualified" ? randomInt(7, 9) :
                    disposition === "connected" ? randomInt(5, 8) :
                    randomInt(4, 7);
      
      // Generate transcript for all answered calls including voicemails, but not for no-answer
      const transcript = disposition !== "no-answer" ? generateTranscript(lead.contactName, lead.companyName, disposition, lead.painPoints) : null;
      const coachingNotes = duration > 120 ? generateCoachingAnalysis(score, disposition) : null;
      
      const [session] = await db.insert(callSessions).values({
        callSid: `demo_call_${sdr.id}_${i}_${Date.now()}_${randomInt(1000, 9999)}`,
        userId: sdrUser.id,
        leadId: lead.id,
        direction: "outbound",
        fromNumber: "+18885551234",
        toNumber: `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`,
        status: "completed",
        duration: duration,
        transcriptText: transcript,
        coachingNotes: coachingNotes,
        managerSummary: duration > 180 && Math.random() > 0.4 ? `${disposition === "meeting-booked" ? "Excellent call - demo successfully scheduled with multiple stakeholders." : disposition === "qualified" ? "Good qualification call - prospect shows strong buying signals." : "Productive conversation - follow-up required."} ${sdr.name} ${score >= 8 ? "demonstrated excellent skills" : score >= 6 ? "showed solid performance" : "has room for improvement"}.` : null,
        startedAt: callDate,
        endedAt: new Date(callDate.getTime() + duration * 1000),
        disposition: disposition,
        sentimentScore: score,
        keyTakeaways: duration > 120 ? `Key interest in ${randomItem(["Customer Support Team", "Virtual Assistants", "Accounting Team", "Technical Support", "Dedicated Agents"])}. ${lead.painPoints[0]}` : null,
        nextSteps: disposition === "meeting-booked" ? "Demo scheduled with solutions engineer" : 
                   disposition === "qualified" ? "Send proposal and case studies" :
                   disposition === "callback-scheduled" ? "Follow up call scheduled" : 
                   disposition === "connected" ? "Send introduction materials" : null,
      }).returning();
      
      if (session && duration > 120) {
        // Generate individual scores
        const openingScore = Math.min(10, Math.max(1, randomInt(score - 1, score + 2)));
        const discoveryScore = Math.min(10, Math.max(1, randomInt(score - 1, score + 1)));
        const listeningScore = Math.min(10, Math.max(1, randomInt(score, score + 2)));
        const objectionScore = Math.min(10, Math.max(1, randomInt(score - 2, score + 1)));
        const valueScore = Math.min(10, Math.max(1, randomInt(score - 1, score + 1)));
        const closingScore = Math.min(10, Math.max(1, randomInt(score - 2, score + 2)));
        const complianceScore = randomInt(8, 10);
        
        // Generate detailed observations, recommendations, and criteria
        const detailedObservations = generateDetailedObservations(score, disposition, sdr.name);
        const detailedRecommendations = generateDetailedRecommendations(score, openingScore, discoveryScore, objectionScore, closingScore, valueScore);
        const criteriaMet = generateCriteriaMet(openingScore, discoveryScore, valueScore, closingScore, complianceScore);
        
        await db.insert(managerCallAnalyses).values({
          callSessionId: session.id,
          sdrId: sdr.id,
          sdrName: sdr.name,
          callDate: callDate,
          callType: "outbound_prospecting",
          durationSeconds: duration,
          overallScore: score,
          openingScore: openingScore,
          discoveryScore: discoveryScore,
          listeningScore: listeningScore,
          objectionScore: objectionScore,
          valuePropositionScore: valueScore,
          closingScore: closingScore,
          complianceScore: complianceScore,
          keyObservations: detailedObservations,
          recommendations: detailedRecommendations,
          criteriaComparison: criteriaMet,
          summary: `${duration >= 300 ? "Extended" : "Standard"} prospecting call with ${lead.companyName}. ${disposition === "meeting-booked" ? "High-value outcome with demo scheduled." : disposition === "qualified" ? "Qualified opportunity identified." : "Productive conversation establishing rapport."} Overall performance: ${score >= 8 ? "Excellent execution demonstrating mastery of sales fundamentals." : score >= 6 ? "Solid performance with identified areas for continued development." : "Call reveals coaching opportunities to strengthen core skills."}`,
        }).onConflictDoNothing();
      }
      
      callCount++;
    }
  }
  console.log(`   ✅ Created ${callCount} call sessions (${recentCallCount} in last week)\n`);
  
  console.log("🎉 Demo data seeding complete!\n");
  console.log("📊 Summary:");
  console.log(`   - ${createdManagers.length} Managers`);
  console.log(`   - ${createdSdrs.length} SDRs`);
  console.log(`   - ${createdAEs.length} Account Executives`);
  console.log(`   - ${createdLeads.length} Leads with detailed research`);
  console.log(`   - ${callCount} Call sessions with analysis`);
  console.log(`   - ${recentCallCount} Recent calls (last 7 days)`);
  console.log(`\n🔑 All demo accounts use password: ${DEMO_PASSWORD}`);
  console.log(`\n📧 Example logins:`);
  console.log(`   - SDR: carlos.martinez@hawkridgesys.com`);
  console.log(`   - Manager: roberto.hernandez@hawkridgesys.com`);
}

seedDemoData()
  .then(() => {
    console.log("\n✅ Seed completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  });
