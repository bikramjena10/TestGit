var assert = require("assert"),
    should=require("should"),
    GalenPages = require("./../../main/resources/js/GalenPages").GalenPages,
    $page = require("./../../main/resources/js/GalenPages").$page,
    $list = require("./../../main/resources/js/GalenPages").$list,
    $component = require("./../../main/resources/js/GalenPages").$component,
    assertThat = require("./assertThat.js").assertThat,
    assertError = require("./assertThat.js").assertError,
    AssertEvents = require("./events.js").AssertEvents;

var dummyDriver = {};

// By object is redefined in order to test that locators are properly converted
By = {
    id: function (value) {
        return {t: "id", v: value};
    },
    cssSelector: function (value) {
        return {t: "css", v: value};
    },
    xpath: function (value) {
        return {t: "xpath", v: value};
    }
};
function toJson(obj) {
    return JSON.stringify(obj);
};

// Thread object is mocked in order test how galen waits for pages
Thread = {
    sleep: function (time) {
    }
};

// Mocking the TestSession
TestSession = {
    current: function() {
        return {
            getReport: function() {
                return {
                    sectionStart: AssertEvents.registerFunction("TestSession.current().getReport().sectionStart", 1),
                    sectionEnd: AssertEvents.registerFunction("TestSession.current().getReport().sectionEnd", 0),
                    info: function (name) {
                        AssertEvents.say("report.info()", [name]);
                        return {
                            withDetails: function (details) {
                                AssertEvents.say("report.info().withDetails()", [details]);
                            }
                        };
                    }
                };
            }
        }
    }
};

/*
 * Mocking java list
 */
function JavaList(items) {
    this.items = items;
}
JavaList.prototype.size = function () {
    return this.items.length;
};
JavaList.prototype.get = function (index) {
    if (index >= this.size()) {
        throw new Error("Index out of bounds: " + index);
    }
    return this.items[index];
};

/*
 * Mocking a WebDriver
 */
function RecordingDriver() {
    this.actions = [];
}
RecordingDriver.prototype.get = function (url) {
    this.record("#get " + url);
};
RecordingDriver.prototype.record = function (action) {
    this.actions[this.actions.length] = action;
};
RecordingDriver.prototype.clearActions = function () {
    this.actions = [];
};
RecordingDriver.prototype.findElement = function (by) {
    this.record("#findElement " + toJson(by));
    return new RecordingWebElement(by, this);
};
RecordingDriver.prototype.findElements = function (by) {
    this.record("#findElements" + toJson(by));
    /*
    always return two mocked elements so that we can test stuff related to $list
     */
    return new JavaList([
        new RecordingWebElement(by, this),
        new RecordingWebElement(by, this)
    ]);
};
RecordingDriver.prototype.navigate = function () {
    return new RecordingDriverNavigation(this);
},
RecordingDriver.prototype.getCurrentUrl = function () {
    this.record("#getCurrentUrl");
    return "http://fakeurl.fake";
},
RecordingDriver.prototype.getPageSource = function () {
    this.record("#getPageSource");
    return "<fake>page source</fake>";
},
RecordingDriver.prototype.getTitle = function () {
    this.record("#getTitle");
    return "Fake title";
};


/*
 * Mocking a WebDriver.Navigatation
 */
function RecordingDriverNavigation(driver) {
    this.driver = driver;
    this.reload = function () {
        this.driver.record("#navigate().reload");
    },
    this.back = function () {
        this.driver.record("#navigate().back");
    }
}

/*
 * Mocking a WebElement
 */
function RecordingWebElement(locator, driver) {
    this.actions = [];
    this.driver = driver;
    this.locator = locator;
}
RecordingWebElement.prototype.click = function () {
    this.record("#click");
};
RecordingWebElement.prototype.sendKeys = function (keys) {
    this.record("#sendKeys " + keys);
};
RecordingWebElement.prototype.clear = function () {
    this.record("#clear");
};
RecordingWebElement.prototype.isDisplayed = function () {
    this.record("#isDisplayed");
    return true;
};
RecordingWebElement.prototype.isEnabled = function () {
    this.record("#isEnabled");
    return true;
};
RecordingWebElement.prototype.getAttribute = function (attrName) {
    this.record("#getAttribute " + attrName);
    return "";
};
RecordingWebElement.prototype.getCssValue = function (cssProperty) {
    this.record("#getCssValue " + cssProperty);
    return "";
};
RecordingWebElement.prototype.getText = function () {
    this.record("#getText");
    return "";
};
RecordingWebElement.prototype.record = function (action) {
    this.actions[this.actions.length] = action;
    this.driver.record(action);
};
RecordingWebElement.prototype.clearActions = function () {
    this.actions = [];
};
RecordingWebElement.prototype.findElement = function (locator) {
    this.record("#findElement " + toJson(locator));
    return new RecordingWebElement(locator, this.driver);
};


describe("GalenPages", function (){
    describe("#convertTimeToMillis", function () {
        it("should convert time from string", function () {
            var data = [
                ["1000", 1000],
                ["1m", 60000],
                ["1 m", 60000],
                ["2m", 120000],
                ["1s", 1000],
                ["10 s", 10000]
            ];

            for (var i = 0; i<data.length; i++) {
                var realValue = GalenPages.convertTimeToMillis(data[i][0]);
                assertThat("Check #" + i + " should be", realValue).is(data[i][1]);
            }
        });
    });

    describe("#parseLocator", function () {
        it("should parse a css locator by default when type is not specified", function () {
            var locator = GalenPages.parseLocator(".div ul li");
            assertThat("locator should be", locator).is(new GalenPages.Locator("css", ".div ul li"));
        });

        it("should parse a locator by specified type", function () {
            assertThat("locator should be",
                GalenPages.parseLocator("css: .div ul li")
            ).is(
                new GalenPages.Locator("css", ".div ul li")
            );
            assertThat("locator should be",
                GalenPages.parseLocator("id: list")
            ).is(
                new GalenPages.Locator("id", "list")
            );
            assertThat("locator should be",
                GalenPages.parseLocator("xpath: //div/ul/li")
            ).is(
                new GalenPages.Locator("xpath", "//div/ul/li")
            );
        });

        it("should throw error in case of unknown locator", function () {
            assertError(function () {
                GalenPages.parseLocator("unknowntype: first-child div")
            }).is("Unknown locator type: unknowntype");
        });

        it("should not parse type in case of advanced css selectors", function () {
            assertThat("locator should be",
                GalenPages.parseLocator(".section li:first-child div")
            ).is(
                new GalenPages.Locator("css", ".section li:first-child div")
            );
        });
    });

    describe("#wait", function () {
        it("should throw error if waiting for nothing", function () {
            assertError(function () {
               GalenPages.wait({time: 4000, period: 1000}).untilAll({});
            }).is("You are waiting for nothing");
        });
        it("should allow to wait in milliseconds for multiple named conditions", function () {
            var counter1 = 0, counter2 = 0, counter3 = 0;
            GalenPages.wait({time: 4000, period: 1000}).untilAll({
                "Element 1": function () { counter1++; return true;},
                "Element 2": function () { counter2++; return true;},
                "Element 3": function () { counter3++; return true;}
            });

            counter1.should.equal(1);
            counter2.should.equal(1);
            counter3.should.equal(1);
        });
        it("should allow to wait in minutes and seconds", function () {
            var counter = 0;

            assertError(function () {
                GalenPages.wait({time: "2m", period: "30s"}).untilAll({
                    "Element 1": function () { counter++; return false;}
                });
            }).is("timeout error waiting for:\n  - Element 1");

            counter.should.equal(5);
        }),
        it("should throw error with all failing user defined messages", function () {

            var counter1 = 0, counter2 = 0, counter3 = 0;

            assertError(function () {
                GalenPages.wait({time: 4000, period: 2000}).untilAll({
                    "Element 1": function () { counter1++; return true;},
                    "Element 2": function () { counter2++; return false;},
                    "Element 3": function () { counter3++; return false;}
                });
            }).is("timeout error waiting for:\n  - Element 2\n  - Element 3");

            counter1.should.equal(3);
            counter2.should.equal(3);
            counter3.should.equal(1);
        });
        it("should allow to wait forEach element in array", function () {
            var elements = [
                {calls: 0, isDisplayed: function (){this.calls++; return true;}},
                {calls: 0, isDisplayed: function (){this.calls++; return false;}},
                {calls: 0, isDisplayed: function (){this.calls++; return false;}}
            ];

            assertError(function (){
                GalenPages.wait({time: "10s"}).forEach(elements, "test element should be visible", function (element) {
                    return element.isDisplayed();
                });
            }).is("timeout error waiting for:\n  - #2 test element should be visible\n  - #3 test element should be visible");

            assertThat("Item 0 calls is ", elements[0].calls).is(11);
            assertThat("Item 1 calls is ", elements[1].calls).is(11);
            assertThat("Item 2 calls is ", elements[2].calls).is(1);
        });
    });


    describe("#Page", function () {
        var driver = new RecordingDriver();

        it("should create a simple page", function () {
            var page = new GalenPages.Page(driver, "some page", {});
            should.exist(page);
            should.exist(page.driver);
            should.exist(page.findChild);
            should.exist(page.findChildren);

            page.driver.should.equal(driver);
        });

        it("should create a simple page and replace properties", function () {
            var page = new GalenPages.Page(driver, "some page").set({
                someProperty: "some value"
            });
            should.exist(page);
            should.exist(page.driver);
            should.exist(page.findChild);
            should.exist(page.findChildren);
            page.driver.should.equal(driver);
            should.exist(page.someProperty);
            assertThat("somePropery of page should be equal", page.someProperty).is("some value");
        });

        it("should create a page with fields and evalSafeToString id css xpath locators", function (){
            var page = new GalenPages.Page(driver, "some page", {
                label: ".some label",
                link: "id:  some-link",
                button: "xpath: //some-button"
            });

            should.exist(page.label);
            should.exist(page.link);
            should.exist(page.button);

            toJson(page.label.locator).should.equal(toJson({type: "css", value: ".some label"}));
            toJson(page.link.locator).should.equal(toJson({type: "id", value: "some-link"}));
            toJson(page.button.locator).should.equal(toJson({type: "xpath", value: "//some-button"}));
        });

        it("Should identify css and xpath locators based on their first character", function () {
            var page = new GalenPages.Page(driver, "some page", {
                css01: ".some label",
                css02: "#id",
                xpath01: "//some-button",
                xpath02: "/some-button"
            });

            toJson(page.css01.locator).should.equal(toJson({type: "css", value: ".some label"}));
            toJson(page.css02.locator).should.equal(toJson({type: "css", value: "#id"}));

            toJson(page.xpath01.locator).should.equal(toJson({type: "xpath", value: "//some-button"}));
            toJson(page.xpath02.locator).should.equal(toJson({type: "xpath", value: "/some-button"}));
        });

        it("should create a page and use functions as-is with fields", function () {
            var page = new GalenPages.Page(driver, "some page", {
                label: ".some label",
                doIt: function (a) {
                    var b = a +5;
                    return "result is: " + b;
                }
            });

            var returnedValue = page.doIt(3);
            returnedValue.should.equal("result is: 8");
        });

        it("should create a page and split fields into main and secondary", function () {
            var page = new GalenPages.Page(driver, "some page", {
                mainField1: ".some-field-1",
                mainField2: ".some-field-1"
            }, {
                secondaryField1: ".secondary-field-1",
                secondaryField2: ".secondary-field-2"
            });

            assertThat("Primary fields should be", page._primaryFields).is(["mainField1", "mainField2"]);
            assertThat("Secondary fields should be", page._secondaryFields).is(["secondaryField1", "secondaryField2"]);

            assertThat("All field locators should be", page.getAllLocators()).is({
                mainField1: "css: .some-field-1",
                mainField2: "css: .some-field-1",
                secondaryField1: "css: .secondary-field-1",
                secondaryField2: "css: .secondary-field-2"
            });

            should.exist(page.secondaryField1);
            should.exist(page.secondaryField2);
        });

        it("should create page elements with all needed functions", function (){
            var page = new GalenPages.Page(driver, "some page", {
                someField: ".some-field"
            });

            assertThat("page.someField", page.someField).hasFields([
                "click", "typeText", "clear", "isDisplayed", "getWebElement"
            ]);
            assertThat("page.someField.click type should be", page.someField.click).typeIs("function");
            assertThat("page.someField.typeText type should be", page.someField.typeText).typeIs("function");
            assertThat("page.someField.clear type should be", page.someField.clear).typeIs("function");
            assertThat("page.someField.isDisplayed type should be", page.someField.isDisplayed).typeIs("function");
            assertThat("page.someField.getWebElement type should be", page.someField.getWebElement).typeIs("function");
        });
    });

    describe("#extendPage", function () {
        it("should extend page object with page elements", function () {
            var MyPage = function (driver) {
                GalenPages.extendPage(this, driver, "My page", {
                    someField: ".some-field",
                    someFunc: function () {
                        return "some value";
                    }
                });
            };

            var driver = new RecordingDriver();
            var myPage = new MyPage(driver);

            assertThat("myPage.someField", myPage.someField).hasFields([
                "click", "typeText", "clear", "isDisplayed", "getWebElement"
            ]);

            assertThat("Should set a name for a page", myPage.name).is("My page");
        });
    });

    describe("page elements interaction", function () {
        var driver = new RecordingDriver();

        it("should trigger getWebElement only once when doing actions on it", function (){
            driver.clearActions();
            var page = new GalenPages.Page(driver, "some page", {someField: ".some-field"});
            page.someField.click();
            page.someField.typeText("Some text");
            page.someField.clear();
            page.someField.isDisplayed();
            page.someField.getWebElement();
            page.someField.isEnabled();
            page.someField.attribute("someattr");
            page.someField.cssValue("display");

            assertThat("Performed actions on driver should be", driver.actions).is([
                "#findElement {\"t\":\"css\",\"v\":\".some-field\"}",
                "#click","#sendKeys Some text","#clear","#isDisplayed","#isEnabled","#getAttribute someattr","#getCssValue display"
            ]);

            assertThat("Performed actions on web element should be", page.someField.getWebElement().actions).is([
                "#click",
                "#sendKeys Some text",
                "#clear",
                "#isDisplayed",
                "#isEnabled",
                "#getAttribute someattr",
                "#getCssValue display"
            ]);
        });

        it("should report all events", function (){
            driver.clearActions();
            var page = new GalenPages.Page(driver, "some page", {someField: ".some-field"});

            GalenPages.settings.allowReporting = true;

            AssertEvents.assert(function () {
                page.someField.click();
                page.someField.typeText("Some text");
                page.someField.clear();
                page.someField.isDisplayed();
                page.someField.getWebElement();
                page.someField.isEnabled();
                page.someField.attribute("someattr");
                page.someField.cssValue("display");
                page.someField.selectByValue("blahblah");
                page.someField.selectByText("blahblah");
            }).shouldBe([
                {name: "report.info()", args: ["Click someField on some page"]},
                {name: "report.info().withDetails()", args: ["css: .some-field"]},
                {name: "report.info()", args: ["Type \"Some text\" to someField on some page"]},
                {name: "report.info().withDetails()", args: ["css: .some-field"]},
                {name: "report.info()", args: ["Clear someField on some page"]},
                {name: "report.info().withDetails()", args: ["css: .some-field"]},
                {name: "report.info()", args: ["Select by value \"blahblah\" in someField on some page"]},
                {name: "report.info().withDetails()", args: ["css: .some-field"]},
                {name: "report.info()", args: ["Select by text \"blahblah\" in someField on some page"]},
                {name: "report.info().withDetails()", args: ["css: .some-field"]},
            ]);
        });

        it("should not report if reporting is disabled", function (){
            driver.clearActions();
            var page = new GalenPages.Page(driver, "some page", {someField: ".some-field"});

            GalenPages.settings.allowReporting = false;
            TestSession.data = [];

            AssertEvents.assert(function () {
                page.someField.click();
                page.someField.typeText("Some text");
                page.someField.clear();
                page.someField.isDisplayed();
                page.someField.getWebElement();
                page.someField.isEnabled();
                page.someField.attribute("someattr");
                page.someField.cssValue("display");
                page.someField.selectByValue("blahblah");
                page.someField.selectByText("blahblah");
            }).shouldBe([]);
        });

        it("should handle NoSuchElementException from java", function () {
            driver.clearActions();
            driver.findElement = function (){throw new Error("No Such element");}
            var page = new GalenPages.Page(driver, "some page", {
                someField: ".some-field"
            });

            assertError(function (){
                page.someField.typeText("Some text");
            }).is("No such element: css .some-field");

            assertError(function (){
                page.someField.click();
            }).is("No such element: css .some-field");

            assertError(function (){
                page.someField.clear();
            }).is("No such element: css .some-field");

            assertThat("'exists' should give", page.someField.exists()).is(false);
        });
    });

    describe("page waiting", function () {
        var driver = new RecordingDriver();

        it("should wait for primaryFields only", function () {
            driver.clearActions();
            var page = new GalenPages.Page(driver, "some page", {
                label: ".some-field",
                button: ".some-button"
            }, {
                label2: ".some-label2"
            });

            page.label.counter = 0;
            page.label.exists = function () {
                this.counter = this.counter + 1;
                return this.counter > 3;
            };

            page.label2.exists = function () {return false};

            page.waitForIt();

            page.label.counter.should.equal(4);
        });

        it("should throw error if a field is not displayed", function (){
            driver.clearActions();
            var page = new GalenPages.Page(driver, "some page", {
                label: ".some-field",
                button: ".some-button"
            });

            page.label.counter = 0;
            page.label.exists = function () {
                this.counter = this.counter + 1;
                return false;
            };

            assertError(function (){
                page.waitForIt();
            }).is("timeout waiting for some page elements:\n  - label to be displayed");

            page.label.counter.should.equal(11);
        });
    });


    describe("$page", function() {
        it("should create a new function with page elements", function () {
            var LoginPage = $page("Login page", {
                login: "#login",
                password: "#password",

                loginAs: function (email, password) {
                    return "Logging as " + email;
                }
            });

            var loginPage = new LoginPage(dummyDriver);
            assertThat("loginAs function should return", loginPage.loginAs("someuser@example.com", "p"))
                .is("Logging as someuser@example.com");
            should.exist(loginPage.login.locator);
            should.exist(loginPage.password.locator);
        });

        it("should create a page and replace the default functions fron GalenPage.prototype.", function () {
            var LoginPage = $page("Login page", {
                login: "#login",
                password: "#password",

                waitForIt: function () {
                    return "waitForIt stub";
                }
            });

            var loginPage = new LoginPage(dummyDriver);

            should.exist(loginPage.login.locator);
            should.exist(loginPage.password.locator);
            assertThat("Should invoke replaced waitForIt function", loginPage.waitForIt())
                .is("waitForIt stub")
        });
    });

    describe("$list", function () {
        it("should generate a list of components", function () {
            var NoteElement = $page("Note", {
                title: ".title",
                content: ".description",

                getNoteContent: function () {
                    return "some fake content";
                }
            });

            var NotesPage = $page("Notes page", {
                title: "#title",
                notes: $list(NoteElement, "div.notes .note")
            });

            var driver = new RecordingDriver();
            var notesPage = new NotesPage(driver);

            assertThat("There should be 2 notes", notesPage.notes.size())
                .is(2);

            var secondNote = notesPage.notes.get(1);

            assertThat("Should give full name in sub components", secondNote.name)
                .is("#1 of notes on Notes page");

            assertThat("Should give full name in sub components", secondNote.title.name)
                .is("title on Note on #1 of notes on Notes page");

            assertThat("Should be able to retrieve a note", secondNote.getNoteContent())
                .is("some fake content");
        });
    });

    describe("$component", function () {
        it("should generate a single component", function () {
            var Popup = $page("Popup", {
                title: ".title",
                closeButton: ".close"
            });

            var MyPage = $page("My page", {
                popup: $component(Popup, ".popup")
            });

            var driver = new RecordingDriver();
            var myPage = new MyPage(driver);


            myPage.popup.isDisplayed();
            myPage.popup.click();
            myPage.popup.title.click();
            myPage.popup.title.getText();

            assertThat("Actions on driver should be", driver.actions).is([
                "#findElement {\"t\":\"css\",\"v\":\".popup\"}",
                "#isDisplayed", "#click",
                "#findElement {\"t\":\"css\",\"v\":\".popup\"}",
                "#findElement {\"t\":\"css\",\"v\":\".title\"}",
                "#click","#getText"
            ]);

        });
    });

});
