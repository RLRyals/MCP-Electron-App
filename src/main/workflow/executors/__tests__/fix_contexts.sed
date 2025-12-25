# Replace WorkflowExecutionContext instantiations to include all required fields
s/const globalContext: WorkflowExecutionContext = {$/const globalContext = createTestContext({/
s/const context: WorkflowExecutionContext = {$/const context = createTestContext({/
