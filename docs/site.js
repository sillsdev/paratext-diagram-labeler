// Simple JavaScript for navigation and page management
class SiteManager {
  constructor() {
    this.pages = new Map();
    this.currentPage = '';
    this.init();
  }

  init() {
    // Initialize navigation
    this.setupNavigation();

    // Load initial page
    const hash = window.location.hash.slice(1) || 'home';
    this.loadPage(hash);

    // Handle hash changes
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.slice(1) || 'home';
      this.loadPage(page);
    });
  }

  setupNavigation() {
    const navLinks = document.querySelectorAll('.sil-nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        if (page) {
          window.location.hash = page;
        }
      });
    });

    // Setup footer navigation
    const footerLinks = document.querySelectorAll('.sil-footer a[data-page]');
    footerLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        if (page) {
          window.location.hash = page;
        }
      });
    });
  }

  loadPage(pageId) {
    // Remove active class from all nav links
    document.querySelectorAll('.sil-nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Add active class to current page link
    const currentLink = document.querySelector(`[data-page="${pageId}"]`);
    if (currentLink) {
      currentLink.classList.add('active');
    }

    // Handle home page vs other pages display
    this.handlePageLayout(pageId);

    // Handle Learn page sidebar
    this.handleLearnNavigation(pageId);

    // Load page content
    this.displayPage(pageId);
    this.currentPage = pageId;
  }

  handlePageLayout(pageId) {
    const languageTechStrip = document.getElementById('language-tech-strip');
    const breadcrumbStrip = document.getElementById('breadcrumb-strip');
    const bannerSection = document.getElementById('banner-section');
    const currentPageTitle = document.getElementById('current-page-title');

    if (pageId === 'home') {
      // Show home page elements
      languageTechStrip.style.display = 'block';
      bannerSection.style.display = 'block';
      breadcrumbStrip.style.display = 'none';
    } else {
      // Show non-home page elements
      languageTechStrip.style.display = 'none';
      bannerSection.style.display = 'none';
      breadcrumbStrip.style.display = 'block';

      // Update breadcrumb text
      const pageTitles = {
        'getting-started': 'PREREQUISITES',
        downloads: 'DOWNLOADS',
        learn: 'LEARN',
        'key-concepts': 'LEARN > KEY CONCEPTS',
        'launch-screen': 'LEARN > LAUNCH SCREEN',
        'selecting-template': 'LEARN > SELECTING TEMPLATE',
        interface: 'LEARN > INTERFACE',
        'keyboard-shortcuts': 'LEARN > KEYBOARD SHORTCUTS',
        'working-with-labels': 'LEARN > WORKING WITH LABELS',
        'making-the-maps': 'LEARN > MAKING THE MAPS',
        feedback: 'FEEDBACK',
      };

      currentPageTitle.textContent = pageTitles[pageId] || pageId.toUpperCase();
    }
  }

  handleLearnNavigation(pageId) {
    const sidebar = document.getElementById('learn-nav');
    const contentWrapper = document.querySelector('.sil-content-wrapper');

    const learnPages = [
      'key-concepts',
      'launch-screen',
      'selecting-template',
      'interface',
      'keyboard-shortcuts',
      'working-with-labels',
      'making-the-maps',
    ];

    if (pageId === 'learn' || learnPages.includes(pageId)) {
      sidebar.style.display = 'block';
      contentWrapper.classList.add('with-sidebar');
      this.setupLearnSidebar(pageId);
    } else {
      sidebar.style.display = 'none';
      contentWrapper.classList.remove('with-sidebar');
    }
  }

  setupLearnSidebar(currentPageId) {
    const sidebar = document.getElementById('learn-nav');
    sidebar.innerHTML = `
            <div class="sil-sidebar-header">
                <img src="images/logo.png" alt="Paratext Diagram Labeler" class="sil-sidebar-logo">
            </div>
            <ul class="sil-sidebar-nav">
                <li><a href="#learn" data-page="learn" class="${
                  currentPageId === 'learn' ? 'active' : ''
                }">Overview</a></li>
                <li><a href="#key-concepts" data-page="key-concepts" class="${
                  currentPageId === 'key-concepts' ? 'active' : ''
                }">Key Concepts</a></li>
                <li><a href="#launch-screen" data-page="launch-screen" class="${
                  currentPageId === 'launch-screen' ? 'active' : ''
                }">Launch Screen</a></li>
                <li><a href="#selecting-template" data-page="selecting-template" class="${
                  currentPageId === 'selecting-template' ? 'active' : ''
                }">Selecting a Template</a></li>
                <li><a href="#interface" data-page="interface" class="${
                  currentPageId === 'interface' ? 'active' : ''
                }">Interface Overview</a></li>
                <li><a href="#keyboard-shortcuts" data-page="keyboard-shortcuts" class="${
                  currentPageId === 'keyboard-shortcuts' ? 'active' : ''
                }">Keyboard Shortcuts</a></li>
                <li><a href="#working-with-labels" data-page="working-with-labels" class="${
                  currentPageId === 'working-with-labels' ? 'active' : ''
                }">Working with Labels</a></li>
                <li><a href="#making-the-maps" data-page="making-the-maps" class="${
                  currentPageId === 'making-the-maps' ? 'active' : ''
                }">Making the Maps</a></li>
            </ul>
        `;

    // Setup sidebar navigation
    const sidebarLinks = sidebar.querySelectorAll('a[data-page]');
    sidebarLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        if (page) {
          window.location.hash = page;
        }
      });
    });
  }

  displayPage(pageId) {
    const mainContent = document.querySelector('.sil-content');

    switch (pageId) {
      case 'home':
        mainContent.innerHTML = this.getHomePage();
        break;
      case 'getting-started':
        mainContent.innerHTML = this.getGettingStartedPage();
        break;
      case 'downloads':
        mainContent.innerHTML = this.getDownloadsPage();
        break;
      case 'learn':
        mainContent.innerHTML = this.getLearnOverviewPage();
        break;
      case 'key-concepts':
        mainContent.innerHTML = this.getKeyConceptsPage();
        break;
      case 'launch-screen':
        mainContent.innerHTML = this.getLaunchScreenPage();
        break;
      case 'selecting-template':
        mainContent.innerHTML = this.getSelectingTemplatePage();
        break;
      case 'interface':
        mainContent.innerHTML = this.getInterfacePage();
        break;
      case 'working-with-labels':
        mainContent.innerHTML = this.getWorkingWithLabelsPage();
        break;
      case 'keyboard-shortcuts':
        mainContent.innerHTML = this.getKeyboardShortcutsPage();
        break;
      case 'making-the-maps':
        mainContent.innerHTML = this.getMakingTheMapsPage();
        break;
      case 'feedback':
        mainContent.innerHTML = this.getFeedbackPage();
        break;
      default:
        mainContent.innerHTML = this.getHomePage();
    }

    // Scroll to top
    window.scrollTo(0, 0);
  }

  getHomePage() {
    return `
            <div class="info-card warning-card">
                <h3>🚧 Beta Software Notices</h3>
                <p>If you didn’t already sign up for the beta test program, please do so now by sending an email to <a href="mailto:labeler+subscribe@groups.sall.com">labeler+subscribe@groups.sall.com</a>, and then click the confirm link in the email you receive in reply.</p>
                <p>As this is beta software and primarily intended to test the user experience for integration into Paratext 10:</p>
                <ul>
                    <li>Don’t expect a patch system. Upgrading to the latest version means downloading the installer again and running it to replace your previous version.</li>
                    <li>The app is under active development, and the underlying data structures for representing map data may change. However, we do not anticipate that such changes will have any more impact on users than a typical version update would. E.g. Minor adjustments to the look and feel in order to support the new functionality.</li>
                    <li>The Mac and Linux versions are untested so far. We’d be glad for any help in testing them out.</li>
                </ul>
            </div>

            <div class="content-section">
                <h2 class="section-title">Purpose</h2>
                <p>The Labeler is a tool to prepare labels for maps and other diagrams to be used in a Paratext project. 
                It helps ensure that the labels you use on maps and diagrams in Map Creator or Adobe InDesign actually 
                match the terms used in your Scripture text.</p>
                
                <p>Note that while the work is done in a graphical layout, the goal is not to create an image, but to 
                collect the labels to be used on a map or diagram in either Map Creator or InDesign.</p>
            </div>

            <div class="content-section">
                <h2 class="section-title">Key Features</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                    <div class="info-card">
                        <h3>📍 Smart Label Management</h3>
                        <p>Automatically sync your map labels with terms used in your Scripture text</p>
                    </div>
                    <div class="info-card">
                        <h3>🗺️ Multiple Views</h3>
                        <p>Work with Map View, Table View, and USFM Preview to match your workflow</p>
                    </div>
                    <div class="info-card">
                        <h3>🔄 Paratext Integration</h3>
                        <p>Works with Paratext 8 and 9 project files, with Paratext 10 integration planned</p>
                    </div>
                    <div class="info-card">
                        <h3>📤 Export Ready</h3>
                        <p>Generate data merge files for use in Map Creator or Adobe InDesign</p>
                    </div>
                </div>
            </div>

            <div class="content-section">
                <h2 class="section-title">Editions</h2>
                <p>The goal is to create an extension that is fully integrated in Paratext 10. As such it must be an integrated React app. At present, we have a standalone React app that is separate from Paratext, but which works with Paratext 8 or 9 project files. You can use it to prepare your maps, but the real purpose of the Paratext 9 standalone edition is to test the user experience, so that when integrated into Paratext 10, we’ll be able to have an extension that is intuitive and useful.</p>
                <p>Everything in this site relates to the Paratext 9 standalone edition.</p>
            </div>
        `;
  }

  getKeyConceptsPage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Key Concepts</h1>
                <p class="page-subtitle">Understanding how the Labeler works with your project</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Core Concepts</h2>
                
                <div class="info-card">
                    <ul>
                        <li>A project's <strong>Term Renderings</strong> is where the Labeler will look for text to use in labels.</li>
                        
                        <li>Wherever possible, it looks for the term ID as used in Paratext's Major Biblical Terms list, generally a single Greek or Hebrew word. E.g. Ναζαρά for Nazareth.</li>
                        
                        <li>In some cases, a label such as "Mediterranean Sea" does not have a corresponding word in the source texts, and so a term ID like "mediterranean_sea" is used instead. This is fairly transparent to the user.</li>
                        
                        <li>You store your labels in the Term Renderings so that they will be automatically available on other maps and diagrams. The <a href="#working-with-labels">color-coded statuses</a> will help to ensure that you've done this consistently. However, you are free to export and use labels no matter what status they have. You may have valid reasons not to match the label used for the same location on a different map. E.g. A place is labeled "Mizpah" on one map, but "Mizpah of Moab" on another. But the status will at least make you aware of the difference.</li>
                        
                        <li>There are two ways that you can save diagram labels for later use:</li>
                    </ul>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Saving Your Work</h2>
                <p> There are two ways that you can save diagram labels for later use:</p>
                <div class="info-card">
                    <h3>Method 1: IDML Data Merge Files</h3>
                    <p>You can export all the labels for a diagram into an IDML data merge file, which is the format from which you could merge them into an IDML diagram. It is recommended that you save these in the <code>shared\\labeler</code> folder within your project folder, so that they are included in your send/receive.</p>
                </div>
                
                <div class="info-card">
                    <h3>Method 2: USFM Representation</h3>
                    <p>You can save the USFM representation of the diagram in any appropriate location in your Paratext project, just like you do with \\fig fields to store illustration information. (It is not tied to chapters and verses in an XX book, as was the case with the Scripture Map Labeler.) For this, you must currently copy and paste between the USFM in/out control and your Paratext project. (For the Paratext 10 extension, this would be automatic.) However, the USFM representation has not been finalized, and may change, so it's recommended that for the time being, you store your diagram labels in IDML data merge files.</p>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Map Collections</h2>
                
                <div class="info-card">
                    <p>Multiple organizations may distribute collections of maps and other diagrams, and the Labeler will be able to work with any of them, as well as with custom, private collections.</p>
                </div>
            </div>
        `;
  }

  // Page content methods will be implemented as we build each page
  getGettingStartedPage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Prerequisites</h1>
            </div>
            
            <div class="content-section">
                <div class="info-card">
                    <h3>For Translation Teams  (to use Paratext Diagram Labeler)</h3>
                    <ul>
                        <li><strong>Paratext 9</strong> should already be installed</li>
                    <li>In your Paratext project, it's highly recommended that you at least have the Biblical Terms tool 
                    guess renderings for all Names. Some diagrams will also benefit from Realia guessed renderings.</li>
                    <li>You need to know which formats of maps your typesetter can work with, either Map Creator (.mapx) or Adobe InDesign (.idml)</li>
                    <li>Be sure to read through the <a href="#learn">User Guide</a>.</li>
                    </ul>
                </div>
                
                <div class="info-card">
                    <h3>For the Typesetter (to create maps from data merge files exported from Labeler)</h3>
                    <ul>
                    <li>You will need either <a href="https://fmosoft.com/map-creator">Map Creator</a> to work with .mapx files or 
                            <a href="https://www.adobe.com/products/indesign.html">Adobe InDesign</a> to work with .idml files</li>
                    <li>If you want to use the built-in maps that come with Map Creator, instead use the editions of these maps 
                    that are provided in the SIL Map Repository (with usage rules code "fmo" for FMOSoft), as these labels will align more consistently with the labels used
                    by Paratext Diagram Labeler.</li>
                        <li>Download all maps and diagrams from the <a href="https://tiny.cc/sil-maps">SIL Map Repository</a>
                            <br><em>Tip: Download the <strong>compact</strong> edition, not the expanded edition, which only adds redundant clutter, 
                            and does not include the SMR edition of the FMOSoft maps and diagrams.</em></li>

                    </ul>
                </div>
                
            </div>
        `;
  }

  getLaunchScreenPage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Launching the Labeler</h1>
                <p class="page-subtitle">The pre-launch screen and settings</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Starting the Application</h2>
                <p>On Windows, the <strong>Paratext Diagram Labeler</strong> should appear in your Start menu, or you can run the executable from wherever you installed it.</p>
                
                <p>You will see the "pre-Launch" screen that contains the context that the Paratext 10 extension will (in the future) provide:</p>
                
                <div class="info-card">
                    <img src="images/image7.png" alt="Pre-Launch Screen" style="max-width: 100%;">
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Settings</h2>
                
                <div class="info-card">
                    <h3>Template Folder</h3>
                    <p>The installer initially places the templates folder (<strong>_LabelerTemplates</strong>) in the same folder as the Paratext Diagram Labeler executable. It's recommended that you leave it there, so that when you install an updated version, you'll be able to immediately use the updated files.</p>
                </div>
                
                <div class="info-card">
                    <h3>Project Folder</h3>
                    <p>Specify the full path to your Paratext project folder. E.g. "C:\\My Paratext 9 Projects\\Zezi".</p>
                </div>
                
                <div class="info-card">
                    <h3>Save Renderings To</h3>
                    <p>If you don't want the Labeler to directly modify your <strong>TermsRendering.xml</strong> file (that Paratext uses), select <strong>TermsRenderings-Demo.xml</strong> instead. Once you're satisfied with the changes to this file, you can replace your original <strong>TermRenderings.xml</strong> file with it.</p>
                </div>
                
                <div class="info-card">
                    <h3>USFM In/Out</h3>
                    <p>If you paste a USFM representation of a diagram into this space, Labeler will use it when launched. Clicking the OK button after Labeler is launched will return the diagram's USFM representation. It will persist there for subsequent uses of the Labeler, or you can copy and paste it into an appropriate location in your Paratext project.</p>
                    
                    <p>If this area does not contain relevant USFM, you'll be prompted to browse for a diagram template when you click the Launch button.</p>
                </div>
                
                <p>Once these settings provide the necessary context for the Labeler, click the Launch button.</p>
            </div>
        `;
  }

  getSelectingTemplatePage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Selecting a Diagram Template</h1>
                <p class="page-subtitle">How to browse and choose map templates</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Opening the Template Browser</h2>
                <p>If you click the Launch button with no template specified in the USFM, or if you ever click the "Browse for map template" button (its icon looks like a yellow file folder), this will open the system file picker dialog, like this (on Windows machines):</p>
                
                <div class="info-card">
                    <img src="images/image2.png" alt="File picker dialog" style="max-width: 100%;">
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Browsing Templates</h2>
                
                <div class="info-card">
                    <ul>
                        <li>It's recommended that you make this dialog as large as possible, and then choose "Extra large icons" to display. <span class="maroonOval">1</span> You may also want to toggle the preview pane on if it's hidden, for a closer view of template images.</li>
                        
                        <li>The first time you run Paratext Diagram Labeler, it copies "!All Map Samples" to your Pictures folder. The advantage of it being there is that it will be indexed. If you don't need the Spanish versions, you can delete the <code>SMR @es</code> folder.</li>
                        
                        <li>Navigate to that folder.</li>
                        
                        <li>You can browse the images without filtering, but it may be faster to find a suitable map by using the search bar. In the above example, we searched for <span class="searchTerm">armor</span>. <span class="maroonOval">2</span>
                        
                        <br><br>If you wanted to see all the samples of black and white maps of Paul's third missionary journey, you could use a search for <span class="searchTerm">bw AND paul</span> or <span class="searchTerm">bw AND act18</span>. To further restrict the search to only maps supported by InDesign or Map Creator, add the keyword <span class="searchTerm">IDML</span> or <span class="searchTerm">MAPX</span> respectively. E.g. "<span class="searchTerm">bw AND paul AND mapx</span>".
                        
                        <br><br>All sample maps are also tagged with one of the following searchable tags that indicate the type of map:
                        
                        <ul style="margin-top: 0.5rem;">
                            <li><span class="searchTerm">BWR</span>: black & white, relief</li>
                            <li><span class="searchTerm">BWF</span>: black & white, flat</li>
                            <li><span class="searchTerm">BBR</span>: blue & brown, relief</li>
                            <li><span class="searchTerm">BBF</span>: blue & brown, flat</li>
                            <li><span class="searchTerm">FCR</span>: full color, relief</li>
                            <li><span class="searchTerm">FCF</span>: full color, flat</li>
                            <li><span class="searchTerm">MCR</span>: muted color, relief</li>
                        </ul>
                        
                        <br>Other example searches:
                        <ul style="margin-top: 0.5rem;">
                            <li><span class="searchTerm">mapx</span> - All Map Creator maps</li>
                            <li><span class="searchTerm">fcr OR bbr</span> - Maps with full color relief OR blue-brown relief versions available</li>
                            <li><span class="searchTerm">bwf idml</span> - Black & White flat maps in IDML format</li>
                            <li><span class="searchTerm">ACT08</span> - Maps for Acts 8</li>
                            <li><span class="searchTerm">*gt</span> - Greg Thompson maps/diagrams</li>
                        </ul></li>
                        
                        <li>Note that the first time you run this, the operating system may not have had time yet to index the sample maps, so searching by keyword might not work until your machine has had enough idle time to finish indexing.</li>
                        
                        <li>While the sample maps folder contains separate images for the different varieties that one master file can produce, it won't matter which of these you select to identify the template.</li>
                        
                        <li>Once you've selected the template you want to use, click the <strong>Open</strong> button.</li>
                    </ul>
                </div>
            </div>
        `;
  }

  getInterfacePage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Using the Labeler</h1>
                <p class="page-subtitle">Understanding the Labeler's main interface</p>
            </div>
            
            <div class="content-section">
                <p>You can think of the launched Labeler window as an enhanced version of the familiar Biblical Terms tool. It is divided into three resizable panes, like this:</p>
                
                <div class="info-card">
                    <img src="images/image10.png" alt="Main Labeler Interface" style="max-width: 100%;">
                </div>
                
                <p>The <strong>main pane</strong> <span class="maroonOval">1</span> is typically used in "map view" to show the labels overlaid on an image. Each of the labels is color-coded to indicate the kind of attention that the label may need. Please see the <a href="#working-with-labels">Label Status</a> topic below for details. The <strong>zoom buttons</strong> <span class="maroonOval">2</span> enable zooming in and out on the diagram.</p>
                
                <p>In the <strong>details pane</strong> on the right, the <strong>view buttons</strong> <span class="maroonOval">3</span> enable you to select between "map view", "table view", and "USFM view" to be shown in the main pane.</p>
                
                <p>The <strong>OK</strong> and <strong>Cancel</strong> buttons <span class="maroonOval">4</span> will return you to the pre-launch screen, with or without updating the USFM representation there.</p>
                
                <p>The <strong>Settings</strong> cog <span class="maroonOval">5</span> provides access to various user-interface settings:</p>
                
                <table style="width: 100%; margin: 1rem 0;">
                    <tr>
                        <td style="width: 40%; vertical-align: top;">
                            <img src="images/image16.png" alt="Settings Menu" style="max-width: 100%;">
                        </td>
                        <td style="vertical-align: top; padding-left: 1rem;">
                            <p><strong>Label Size:</strong> Scale the labels to balance readability with space efficiency on your screen.</p>
                            <p><strong>Label Opacity:</strong> Reduce opacity to see the underlying sample of style that will be applied in Map Creator / InDesign.</p>
                            <p><strong>Language:</strong> Select a language for the user interface. (Note that the strings in other languages are currently just A.I.-translated, not yet human-checked.)</p>
                            <p><strong>Show tally fractions:</strong> Check this box to display the fraction of found renderings directly on the labels.</p>
                        </td>
                    </tr>
                </table>
                
                <p>The <strong>template group</strong> <span class="maroonOval">6</span> displays the name of the current diagram template, and provides buttons for the following template actions:</p>
                <ul>
                    <li><strong style="background: #4a86e8; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">Template Info</strong>: Display information about the current diagram, including a link to usage and attribution rules.</li>
                    <li><strong style="background: #ffd966; color: black; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">Browse for Template</strong>: Load a different diagram by browsing either for a template JPG image, or for an IDML data merge file that you've previously saved, as described in the <a href="#selecting-template">Selecting a Diagram Template</a> section above.</li>
                    <li><strong style="color: #1155cc; font-size: 0.8em;">Export to Data Merge File</strong>: Use this to save your current diagram to a text file for data merge into either InDesign (IDML) or Map Creator (MAPX) master files. It's recommended that you save such files to your project's <code>shared\\labeler</code> folder, so that they will be included in Paratext's send/receive.</li>
                </ul>
                
                <p>The <strong>tally box</strong> <span class="maroonOval">7</span> displays the count of each status of label in the diagram.</p>
                
                <p>The <strong>label group</strong> <span class="maroonOval">8</span> displays:</p>
                <ul>
                    <li>information about the currently selected label, including the major-language gloss, the source-language Biblical term, and some contextual information to aid in translation.</li>
                    <li>an expandable <strong>vernacular label box</strong> <span class="maroonOval">9</span> in which you can provide or edit the vernacular text for that label, and see a detailed explanation of that label's status, in some cases with quick action buttons.</li>
                    <li>the <strong>term renderings</strong> box <span class="maroonOval">10</span>, in which you can edit your term renderings. (Note: Term rendering history tracking is not yet implemented.)</li>
                </ul>
                
                <p>The <strong>bottom pane</strong> <span class="maroonOval">11</span> displays the available Scripture verses where the term is expected to appear if the translation team has used the term consistently.</p>
                
                <p>Three <strong>filter buttons</strong> <span class="maroonOval">12</span> control which verses are displayed:</p>
                <ul>
                    <li><strong>Show all verses</strong>: Shows all available verses.</li>
                    <li><strong>Show only verses without matching renderings</strong>: Allows you to focus on just the missing renderings.</li>
                    <li><strong>Show unique forms</strong>: Displays just the first occurrence of each inflected form of the rendering.</li>
                </ul>
                
                <p>If any text in the bottom pane is selected, two additional buttons <span class="maroonOval">13</span> become available:</p>
                <ul>
                    <li><strong>Add rendering</strong>: Adds the selected text to the term renderings box as a new rendering.</li>
                    <li><strong>Replace renderings and label</strong>: Replaces the contents of both the terms rendering box and the vernacular label box with the selected text.</li>
                </ul>
                
                <p>There are two buttons at the left edge of each verse in the bottom pane <span class="maroonOval">14</span>:</p>
                <ul>
                    <li><strong>Found status</strong>:
                        <ul>
                            <li>A green checkmark indicates the term has been found.</li>
                            <li>A red X indicates that the term is missing from this verse. If it's OK that it's missing, click the red X to deny that it's a problem.</li>
                            <li>A green checkmark with a small red X indicates that you've examined the verse and denied that the missing rendering is the problem.</li>
                        </ul>
                    </li>
                    <li><strong>Edit verse</strong>: Click the pencil icon to edit the verse in Paratext. (On Windows, Paratext should scroll to the selected verse.)</li>
                </ul>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Table View</h2>
                <p>Table View is just like Map View, but with labels provided in a table instead of being positioned on an image:</p>
                
                <div class="info-card">
                    <img src="images/image13.png" alt="Table View" style="max-width: 100%;">
                </div>
                
                <p>Even if the chosen template is not available on a particular local system, opening a diagram definition (from an *.idml.txt file or from USFM) is at least editable in Table View.</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">USFM View</h2>
                <p>The USFM view displays how the diagram and its labels might be currently represented in USFM 3. Please note that this is subject to change, so at the current time, it is recommended that you save your work by exporting to *.idml.txt files rather than by copying and pasting USFM text to/from your Paratext project.</p>
            </div>
        `;
  }

  getWorkingWithLabelsPage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Working with Labels</h1>
                <p class="page-subtitle">Understanding and managing your map labels</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Label Status System</h2>
                <p>Each label in the Labeler is color-coded to indicate the kind of attention it may need. 
                Here are the different statuses and their meanings:</p>
                
                <div class="info-card">
                    <img src="images/statuses.png" alt="Label Status Indicators" style="max-width: 100%;">
                    <p><em>Different label statuses and their color indicators</em></p>
                </div>
                
            
            
            <div class="content-section">
                <h2 class="section-title">Data Merge Files</h2>
                <p>Once you've completed your label work, the Labeler can generate data merge files for use in Map Creator or Adobe InDesign.</p>
                <p>For detailed instructions on using the exported files, visit the <a href="https://tiny.cc/sil-maps" target="_blank">SIL Maps & Illustrations Repository</a> site, especially the section on <i>How to Use the Maps.</i></p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Migrating Data from Scripture Map Labeler</h2>
                <p>If you've created maps already with the current version of Scripture Map Labeler, those labels will be accessible to you in Paratext Diagram Labeler if you took the step of ensuring your labels were copied into the term renderings. If you have not done that, the easiest way to do that now is to use the <a href="https://tiny.cc/maplabelerhelper">Map Labeler Helper's</a> "Commit Labels" tool.</p>
            </div>
        `;
  }

  getKeyboardShortcutsPage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Keyboard Shortcuts</h1>
                <p class="page-subtitle">Speed up your workflow with these shortcuts</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Navigation Shortcuts</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Shortcut</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>PgDn</code></td>
                            <td>Cycle forwards through the labels</td>
                        </tr>
                        <tr>
                            <td><code>PgUp</code></td>
                            <td>Cycle backwards through the labels</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Zoom Shortcuts</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Shortcut</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>Ctrl</code> + <code>+</code></td>
                            <td>Zoom in (increase scale of all text elements)</td>
                        </tr>
                        <tr>
                            <td><code>Ctrl</code> + <code>-</code></td>
                            <td>Zoom out (decrease scale of all text elements)</td>
                        </tr>
                        <tr>
                            <td><code>Ctrl</code> + <code>0</code></td>
                            <td>Reset text zoom to default scale</td>
                        </tr>
                        <tr>
                            <td><code>Ctrl</code> + <code>9</code></td>
                            <td>Reset map zoom to fit window</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
  }

  getDownloadsPage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Downloads</h1>
                <p class="page-subtitle">Get the latest version of Paratext Diagram Labeler</p>
            </div>
            
            <div class="content-section">
                <div class="info-card">
                    <a href="https://github.com/sillsdev/paratext-diagram-labeler/releases" target="_blank" class="btn" style="display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0;">
                        📥 Download from GitHub Releases
                    </a>
                    <p style="margin-top: 10px;"><small><em>Opens in a new tab</em></small></p>
                </div>
                
                <div class="info-card">
                    <h3>Installation Instructions</h3>
                    <ol>
                        <li>Download the <strong>Paratext Diagram Labeler Setup</strong> program for your operating system</li>
                        <li>Run the installer with administrator privileges if required</li>
                        <li>Follow the setup wizard instructions</li>
                        <li>The application will appear in your Start menu (Windows) or Applications folder (Mac)</li>
                    </ol>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">System Requirements</h2>
                <div class="info-card">
                    <ul>
                        <li><strong>Windows:</strong> Windows 10 or later (primary supported platform)</li>
                        <li><strong>Linux:</strong> Modern Linux distributions (less tested)</li>
                        <li><strong>Mac:</strong> macOS 10.14 or later (less tested)</li>
                    </ul>
                    <p><em>Note: Mac and Linux versions are relatively untested. We'd appreciate help testing them out.</em></p>
                </div>
            </div>
        `;
  }


  getMakingTheMapsPage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Making the Maps</h1>
                <p class="page-subtitle"><i>Getting from data merge files to finished maps</i></p>
            </div>
            <br>
            <div class="content-section">
                <p>After the data merge files have been exported from the Labeler, they can be imported into the corresponding IDML or MAPX file to create your finished, localized maps.</p>
                
                <div class="info-card">
                    <h3>Next Steps</h3>
                    <p>The process of importing data merge files and creating finished maps varies depending on whether you're using Adobe InDesign (IDML files) or Map Creator (MAPX files).</p>
                    
                    <p>For detailed instructions and tips on how to make the maps, please visit the <strong>SIL Map and Illustrations Repository</strong>:</p>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="https://tiny.cc/sil-maps" target="_blank" class="btn" style="display: inline-block; padding: 12px 24px; background: var(--sil-medium-blue); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            📚 Visit SIL Map Repository
                        </a>
                    </p>
                    
                </div>
                
                <div class="info-card">
                    <h3>What You'll Find</h3>
                    <p>The SIL Map and Illustrations Repository provides:</p>
                    <ul>
                        <li>Step-by-step instructions for data merging in InDesign</li>
                        <li>Guidance on importing translations into Map Creator</li>
                        <li>Tips for adjusting and finalizing your maps</li>
                        <li>Best practices for map typography and layout</li>
                        <li>Access to map templates</li>
                    </ul>
                </div>
            </div>
        `;
  }

  getFeedbackPage() {
    return `
            <div class="page-header">
                <h1 class="page-title">Feedback</h1>
            </div>
            
            <div class="content-section">
                <div class="info-card">
                    <h3>Share Your Experience</h3>
                    <p>Thank you for your willingness to beta test this software. After installing and using this software, 
                    please complete our feedback form:</p>
                    
                    <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSc2gEdVYaRTemTOje2Yhly7bNcjSTqv9i3LVlG8c74oIwgfXA/viewform?embedded=true" width="100%" height="1500" frameborder="0" marginheight="0" marginwidth="0" style="border-radius: 8px; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">Loading…</iframe>
                    
                </div>
            </div>
        `;
  }

  getLearnOverviewPage() {
    return `
            <div class="content-section">
                <h1 class="page-title">Learn</h1>
                <p>Master the Paratext Diagram Labeler with our comprehensive guides and tutorials.</p>

                <h2>User Guide</h2>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3><span style="font-size: 24px; margin-right: 8px;">💡</span><a href="#key-concepts" data-page="key-concepts">Key Concepts</a></h3>
                        <p>Understand the fundamental principles behind diagram labeling and how the application works.</p>
                    </div>
                    <div class="feature-card">
                        <h3><span style="font-size: 24px; margin-right: 8px;">🚀</span><a href="#launch-screen" data-page="launch-screen">Launch Screen</a></h3>
                        <p>Learn how to navigate the initial setup and project selection process.</p>
                    </div>
                    <div class="feature-card">
                        <h3><span style="font-size: 24px; margin-right: 8px;">📋</span><a href="#selecting-template" data-page="selecting-template">Selecting a Template</a></h3>
                        <p>Choose the right template or create custom layouts for your mapping needs.</p>
                    </div>
                    <div class="feature-card">
                        <h3><span style="font-size: 24px; margin-right: 8px;">🖥️</span><a href="#interface" data-page="interface">Interface Overview</a></h3>
                        <p>Navigate the application interface efficiently with our detailed walkthrough.</p>
                    </div>
                    <div class="feature-card">
                        <h3><span style="font-size: 24px; margin-right: 8px;">⌨️</span><a href="#keyboard-shortcuts" data-page="keyboard-shortcuts">Keyboard Shortcuts</a></h3>
                        <p>Speed up your workflow with essential keyboard shortcuts and hotkeys.</p>
                    </div>
                    <div class="feature-card">
                        <h3><span style="font-size: 24px; margin-right: 8px;">🏷️</span><a href="#working-with-labels" data-page="working-with-labels">Working with Labels</a></h3>
                        <p>Master label creation, editing, and management for accurate map annotation.</p>
                    </div>
                </div>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3><span style="font-size: 24px; margin-right: 8px;">⚒️</span><a href="#making-the-maps" data-page="making-the-maps">Making the Maps</a></h3>
                        <p>Getting from data-merge files to finished maps.</p>
                    </div>
                </div>

            </div>
        `;
  }
}

// Initialize the site when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SiteManager();
});
