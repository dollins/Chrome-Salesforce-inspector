/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */

class Model {
  constructor(sfHost) {
    this.reactCallback = null;
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.allLimitData = [];
    this.errorMessages = [];
    this.userInfo = '...';
    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
    }));
  }

  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
  }

  spinFor(promise) {
    this.spinnerCount++;
    promise
      .catch(err => {
        console.error("spinFor", err);
      })
      .then(() => {
        this.spinnerCount--;
        this.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }
  
  spinFor2(actionName, promise, cb) {
    this.spinnerCount++;
    promise
      .then(res => {
        this.spinnerCount--;
        cb(res);
        this.didUpdate();
      })
      .catch(err => {
        console.error(err);
        this.errorMessages.push("Error " + actionName + ": " + err.message);
        this.spinnerCount--;
        this.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }

  title() {
    return "Org Limits";
  }

  setLimitsData(res) {
    let self = this;
    this.allLimitData = [];

    Object.keys(res).forEach((key) => {
      self.allLimitData.push({
        key,
        "label": self.humanizeName(key),
        "description": "...",
        "max": res[key].Max,
        "remaining": res[key].Remaining
      });
    });
  }

  humanizeName(name) {
    return name.replace(/([A-Z])/g, " $1"); //TODO: Improve
  }

  startLoading() {
    let limitsPromise = sfConn.rest("/services/data/v" + apiVersion + "/" + "limits");

    this.spinFor2("describing global", limitsPromise, (res) => {
      this.setLimitsData(res);
    });
    
  }
}


let h = React.createElement;

class LimitData extends React.Component {
  render() {
    return (
      h("figure", {},
        h("div", {
          className: "gauge"
        },
        h("div", {
          className: "meter",
          ref: "meter"
        },
        ""
        ),
        h("div", {
          className: "meter-value-container"
        },
        h("div", {
          className: "meter-value"
        }, Math.round((1 - (this.props.remaining / this.props.max)) * 100) + "%")
        )
        ),
        h("figcaption", {}, this.props.label,
          h("div", {}, (this.props.max - this.props.remaining).toLocaleString() + " of " + (this.props.max).toLocaleString() + " consumed",
            h("br", {}), "(" + (this.props.remaining).toLocaleString() + " left)"
          ),
        )
      )
    );
  }
  componentDidMount() {
    // Animate gauge to relevant value
    let targetDegree = (this.props.max == 0) ? "180deg" : ((1 - (this.props.remaining / this.props.max)) * 180) + "deg"; //180deg = 100%, 0deg = 0%
    this.refs.meter.animate([{
      transform: "rotate(0deg)"
    }, {
      transform: "rotate(" + targetDegree + ")"
    }], {
      duration: 1000,
      fill: "both"
    });
  }
}

class App extends React.Component {
  render() {
    let vm = this.props.vm;
    document.title = vm.title();
    return (
      h("div", {},
        h("div", {id: "user-info"},
          h("a", {href: vm.sfLink, className: "sf-link"},
            h("svg", {viewBox: "0 0 24 24"},
              h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
            ),
            " Salesforce Home"
          ),
          h("h1", {}, "Org Limits"),
          h("span", {}, " / " + vm.userInfo),
          h("div", {className: "flex-right"},
            h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: vm.spinnerCount == 0},
              h("span", {className: "slds-assistive-text"}),
              h("div", {className: "slds-spinner__dot-a"}),
              h("div", {className: "slds-spinner__dot-b"}),
            ),
            h("a", {href: "#", id: "help-btn", title: "Export Help", onClick: this.onToggleHelp}, 
              h("div", {className: "icon"})
            ),
          ),
        ),
        h("div", {
          className: "body"
        },
        vm.allLimitData.map(limitData =>
          h(LimitData, limitData)
        )
        )
      )
    );
  }
}


{

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = ReactDOM.createRoot(document.getElementById("root"));
    let vm = new Model(sfHost);
    vm.startLoading(args);
    vm.reactCallback = cb => {
      root.render(h(App, {
        vm
      }));
    };
    root.render(h(App, {
      vm
    }));

  });

  {
    let isDragging = false;
    document.body.onmousedown = () => {
      isDragging = false;
    };
    document.body.onmousemove = e => {
      if (e.movementX || e.movementY) {
        isDragging = true;
      }
    };
    document.body.onclick = e => {
      if (!e.target.closest("a") && !isDragging) {
        let el = e.target.closest(".quick-select");
        if (el) {
          getSelection().selectAllChildren(el);
        }
      }
    };
  }

}
