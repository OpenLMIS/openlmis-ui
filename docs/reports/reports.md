# View Reports

Open **Reports > View Reports** to see reports available to your account. Reports are
grouped by category. Categories with no available reports are omitted.

If one section cannot load, its message includes **Try Again**. Reports from other
sections remain available. A missing report may depend on your report permissions;
being an administrator does not automatically make every dashboard available.

View Reports requires a connection and permission to view reports. It does not change
report definitions or calculations.

## Generate A Report

Select a report to open its options page. The page title is the report's name. Its fields,
their order and their labels come from the report itself, exactly as in the legacy screen.
Fields marked with a red asterisk are required.

- Long lists, such as facilities or products, can be searched by typing. Optional choices
  can be cleared.
- A list that cannot be loaded shows its own message with **Try Again**. Other fields stay
  usable and nothing you entered is lost.
- Some choices depend on another field. For example, in the Timeliness Report, choose
  **Program Name** first; **Period Name** then lists that program's periods. Changing the
  program clears the period.
- **Due date (days)** accepts a whole number of 0 or more. Leave it empty to use the
  server's default of 10 days.

Choose a **Format**, then select **Generate**. PDF is chosen by default and opens in a new
tab. CSV, XLS, XLSX and HTML are downloaded as files. HTML reports are downloaded rather
than opened in the app, so their content cannot run inside it.

Large reports can take several minutes. While a report is generating, **Generate** shows
its progress and **Cancel** stops waiting for it. If the report fails, an error message
appears and your options are kept so you can try again.

Some servers return a PDF when XLSX is chosen for requisition reports. The file is then
saved as a PDF and a message says so.

Dashboards still open in the legacy UI, where you may need to sign in separately.

Generating a report requires a connection. Some reports need extra permissions, which the
server checks when you select **Generate**.
