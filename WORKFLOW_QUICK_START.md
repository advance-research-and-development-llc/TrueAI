# Quick Start Guide - New Workflow Features

## 🎯 Overview

TrueAI LocalAI now includes powerful workflow automation features that let you orchestrate multiple agents and tools visually, track costs, and deploy pre-built automation templates.

## 🔀 Visual Workflow Builder

### Creating Your First Workflow

1. **Navigate to Workflows**
   - Click the "Workflows" tab in the main navigation
   - Select "Builder" sub-tab

2. **Start a New Workflow**
   - Click "New Workflow" button
   - Enter a name (e.g., "My First Workflow")
   - Click "Create"

3. **Add Nodes**
   - Use the sidebar buttons to add nodes:
     - **Agent**: Execute an AI agent
     - **Tool**: Run a specific tool
     - **Decision**: Branch based on condition
     - **Parallel**: Run multiple paths simultaneously

4. **Connect Nodes**
   - Drag from one node's edge to another
   - Lines show the execution flow
   - Animated connections indicate data flow

5. **Configure Nodes**
   - Click any node (except Start/End)
   - Set the node configuration:
     - **Agent Node**: Select which agent to run
     - **Tool Node**: Choose the tool
     - **Decision Node**: Set the condition

6. **Save & Execute**
   - Enter workflow name in bottom-left
   - Click "Save Workflow"
   - Click "Execute" to run your workflow

### Example: Simple Research Workflow

```
Start → Web Search → Agent (Analyze Results) → End
```

**Steps**:
1. Add "Tool" node, configure with "web_search"
2. Add "Agent" node, select your research agent
3. Connect: Start → Web Search → Agent → End
4. Save and execute!

## 📋 Using Workflow Templates

### Quick Deployment

1. **Browse Templates**
   - Go to Workflows → Templates tab
   - Use search or filter by category

2. **Preview Template**
   - Click any template card
   - Review description and features
   - Check rating and downloads

3. **Deploy Template**
   - Click "Use Template"
   - Template is copied to your workflows
   - Customize as needed

### Available Templates

#### 1. Content Research & Writing (Featured)
**Use Case**: Generate blog articles with research
- Searches web for topic
- Analyzes findings
- Generates comprehensive article
- Includes citations

**Best For**: Content creators, bloggers, marketers

#### 2. Data ETL Pipeline
**Use Case**: Extract, transform, and load data
- Pulls data from API
- Validates data quality
- Transforms format
- Loads to destination

**Best For**: Data engineers, analysts

#### 3. Code Review Automation (Featured)
**Use Case**: Automated code quality checks
- Reads code file
- Parallel quality & security scans
- Merges results
- Generates report

**Best For**: Developers, DevOps teams

#### 4. Market Research Report
**Use Case**: Competitive intelligence
- Searches trends
- Analyzes competitors
- Generates insights
- Creates report

**Best For**: Product managers, strategists

#### 5. Email Campaign Automation
**Use Case**: Personalized email generation
- Generates email content
- Validates addresses
- Sends or logs errors
- Tracks results

**Best For**: Marketing teams, sales

#### 6. Customer Support Triage (Featured)
**Use Case**: Smart ticket routing
- Analyzes ticket content
- Checks sentiment
- Routes by urgency
- Escalates critical issues

**Best For**: Support teams, customer success

## 💰 Cost Tracking & Budgets

### Setting Up Cost Tracking

1. **View Current Costs**
   - Go to Workflows → Cost Tracking tab
   - See total spending, per-call average, trends

2. **Analyze Spending**
   - **By Model**: See which models cost most
   - **By Resource**: Break down by conversations/agents/workflows
   - **By Time**: View daily/weekly/monthly trends

3. **Create a Budget**
   - Click "New Budget"
   - Set:
     - Name (e.g., "Monthly AI Budget")
     - Amount (e.g., $100)
     - Period (daily/weekly/monthly)
     - Alert threshold (e.g., 80%)
   - Click "Create Budget"

4. **Monitor Budgets**
   - See progress bars showing % spent
   - Get alerts when approaching limits
   - Adjust spending based on insights

### Cost Optimization Tips

1. **Use Cheaper Models for Simple Tasks**
   - GPT-4o-mini costs 85% less than GPT-4o
   - Perfect for summaries, classifications

2. **Set Conservative Budgets**
   - Start with lower limits
   - Increase based on value
   - Get comfortable with spending

3. **Monitor Per-Call Costs**
   - Identify expensive workflows
   - Optimize high-cost operations
   - Use shorter prompts when possible

4. **Export Regular Reports**
   - Click "Export" to download JSON
   - Review monthly spending
   - Plan future budgets

## 🎨 Best Practices

### Workflow Design

1. **Start Simple**
   - Begin with 2-3 nodes
   - Test thoroughly
   - Add complexity gradually

2. **Use Descriptive Names**
   - Name nodes clearly (e.g., "Analyze Customer Feedback")
   - Add descriptions to workflows
   - Document complex logic

3. **Handle Errors**
   - Add decision nodes for error checking
   - Create fallback paths
   - Test failure scenarios

4. **Optimize for Cost**
   - Use appropriate models
   - Avoid redundant API calls
   - Cache results when possible

### Template Usage

1. **Customize Before Using**
   - Review template parameters
   - Adjust for your use case
   - Test with sample data

2. **Learn from Templates**
   - Study how they're built
   - Understand the patterns
   - Apply to your workflows

3. **Iterate and Improve**
   - Start with template
   - Modify based on results
   - Save successful variations

### Budget Management

1. **Set Realistic Limits**
   - Estimate usage first
   - Add 20% buffer
   - Adjust monthly

2. **Monitor Regularly**
   - Check daily if active
   - Review weekly trends
   - Adjust budgets quarterly

3. **Respond to Alerts**
   - Don't ignore warnings
   - Understand why costs increased
   - Optimize or adjust budget

## 🚀 Advanced Workflows

### Parallel Processing

Execute multiple agents simultaneously:

```
         ┌─→ Agent A ─┐
Start ──→│           ├─→ Merge ─→ End
         └─→ Agent B ─┘
```

**Use Cases**:
- Multiple data sources
- Parallel analysis
- Consensus building

### Conditional Branching

Route based on results:

```
                    ├─→ Path A ─→ End
Decision (if X > 5) ┤
                    └─→ Path B ─→ End
```

**Use Cases**:
- Quality thresholds
- Priority routing
- Error handling

### Loop Patterns

Repeat until condition met:

```
Start ─→ Agent ─→ Check ─→ End
           ↑         │
           └─── (if not done)
```

**Use Cases**:
- Iterative refinement
- Data processing batches
- Retry logic

## 💡 Tips & Tricks

### Workflow Builder
- **Zoom**: Mouse wheel or pinch on mobile
- **Pan**: Click and drag canvas
- **Select**: Click node to configure
- **Delete**: Select edge and press Delete

### Templates
- **Search**: Use keywords like "email", "code", "data"
- **Filter**: Select specific category
- **Featured**: Start with featured templates

### Cost Tracking
- **Time Range**: Switch between day/week/month/all
- **Export**: Download for external analysis
- **Budget Status**: Green (safe), Yellow (warning), Red (exceeded)

## 🆘 Troubleshooting

### Workflow Issues

**Problem**: Workflow won't save
- **Solution**: Make sure workflow has a name

**Problem**: Nodes won't connect
- **Solution**: Ensure nodes are compatible (can't connect End to anything)

**Problem**: Execution fails
- **Solution**: Check that all nodes are properly configured

### Template Issues

**Problem**: Template doesn't work as expected
- **Solution**: Check template parameters, customize for your use case

### Cost Tracking Issues

**Problem**: Costs seem inaccurate
- **Solution**: Verify model pricing in code, check token counts

**Problem**: Budget alerts not working
- **Solution**: Ensure budget is enabled, check threshold setting

## 📚 Learn More

- **PRD**: Full feature specifications in `PRD.md`
- **Implementation**: Technical details in `TOOLNEURON_IMPLEMENTATION.md`
- **Comparison**: See how we compare in `TOOLNEURON_COMPARISON.md`

---

**Happy Automating! 🚀**

Build powerful workflows, optimize costs, and automate your AI tasks with TrueAI LocalAI.
