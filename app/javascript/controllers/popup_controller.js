// based on https://www.getsjabloon.com/kb/external-content-in-modals
import { Controller } from 'stimulus'

/**
 * Handles Popup or Offcanvas component with contents, with backend
 * communication.
 */
export default class extends Controller {
  static targets = ['content']
  popupOpener = null
  wrapperTarget = null // the portal destination for the modal dom

  connect() {
    this.url = this.data.get('url'),
    this.toggleClass = this.data.get('showClass') || 'show';
    this.backgroundId = this.data.get('backgroundId') || 'modal-background';
    this.backgroundHtml = this.data.get('backgroundHtml') || this._backgroundHTML();
    this.modalSize = this.data.get('modalSize');

    if (this.element.dataset.action && this.element.dataset.action.indexOf('popup#openModal') > -1) {
      this.popupOpener = this.element
    } else {
      this.popupOpener = this.element.querySelector('[data-action*="popup#openModal"]')
    }

    // To open modal anchors, or each other elements may be used.
    // But if it's an anchor, use its href as url, if nothing other was permitted
    if (this.popupOpener && this.popupOpener.tagName === 'A' && !this.url) {
      this.url = this.popupOpener.getAttribute('href')
    }

    this.heading = this.data.get('heading') || this.popupOpener.text
  }

  disconnect() {
    this.close();
  }

  openModal(e) {
    e.preventDefault()

    if (e.target !== this.element && !this.element.contains(e.target)) {
      return
    }

    if (!this.wrapperTarget) {
      const wrapperId = `modal-wrapper-${Math.floor(Math.random() * 9999999)}`
      document.body.insertAdjacentHTML('beforeend', this._wrapperHTML(wrapperId))

      this.wrapperTarget = document.getElementById(wrapperId)
      this.wrapperTarget[this.identifier] = this
    }

    if (!this.open) {
      this.open = true

      this.getContent(this.url)
      this.wrapperTarget.insertAdjacentHTML('afterbegin', this.template())

      // register events for popup close
      if (this.closeButton) { // popup closed
        this.closeButton.addEventListener('click', e => { this.close(e, true) }, { once: true })
      }

      this.wrapperTarget.addEventListener('turbo:submit-end', this.handleFormSubmission.bind(this))

      // Lock the scroll and save current scroll position
      this.lockScroll();

      this.containerTarget.classList.add(this.toggleClass)

      this.containerTarget.style.display = 'block'
    }
  }

  get closeButton() {
    return this.wrapperTarget.querySelector('[data-dismiss="modal"]')
  }

  get containerTarget() {
    return this.wrapperTarget.querySelector('[data-popup-target="container"]')
  }

  get contentTarget() {
    return this.wrapperTarget.querySelector('[data-popup-target="content"]')
  }

  close(e, cancelled) {
    if (e && typeof e === 'object' && e.preventDefault) {
      e.preventDefault()

      if (e.type === 'turbo:submit-end') {
        e.detail.formSubmission.stop()
        e.stopPropagation()
      }
    }

    if (this.open) {
      this.open = false
      this.containerTarget.classList.remove(this.toggleClass)
      this.wrapperTarget.remove()
      this.wrapperTarget = null

      // Only if an event is given. Otherwise this close() call was done from disconnect(). In this case
      // no info needs to be propagated.
      if (e) {
        this.notifyOpenerAboutClose(cancelled)
      }

      // Remove the background
      if (this.background) { this.background.remove() }

      // Unlock the scroll and restore previous scroll position
      this.unlockScroll();
    }
  }

  closeWithKeyboard(e) {
    if (e.keyCode === 27) {
      this.close(e, true)
    }
  }

  getContent(url) {
    fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' }}).
      then(response => {
        if (response.ok) {
          return response.text()
        }
      })
      .then(html => {
        this.contentTarget.innerHTML = html
      })
  }

  lockScroll() {
    // Add right padding to the body so the page doesn't shift
    // when we disable scrolling
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    // Save the scroll position
    this.saveScrollPosition();

    // Add classes to body to fix its position
    document.body.classList.add('modal-open')
    document.body.classList.add('fixed', 'inset-x-0', 'overflow-hidden');

    // Add negative top position in order for body to stay in place
    document.body.style.top = `-${this.scrollPosition}px`;
  }

  unlockScroll() {
    // Remove tweaks for scrollbar
    document.body.style.paddingRight = null;

    // Remove classes from body to unfix position
    document.body.classList.remove('fixed', 'inset-x-0', 'overflow-hidden');
    document.body.classList.remove('modal-open')

    // Restore the scroll position of the body before it got locked
    this.restoreScrollPosition();

    // Remove the negative top inline style from body
    document.body.style.top = null;
  }

  saveScrollPosition() {
    this.scrollPosition = window.pageYOffset || document.body.scrollTop;
  }

  restoreScrollPosition() {
    document.documentElement.scrollTop = this.scrollPosition;
  }

  _wrapperHTML(wrapperId) {
    return `<div id="${wrapperId}" class="modal-portal"></div>`;
  }

  _backgroundHTML() {
    return `<div id="${this.backgroundId}" class="fixed top-0 left-0 w-full h-full" style="background-color: rgba(0, 0, 0, 0.8); z-index: 9998;"></div>`;
  }

  /**
   * If a modal renders a form, the successful form submission indicates, that the modals job is done.
   */
  handleFormSubmission(evt) {
    let form = null

    if (!evt.detail.success) {
      // if the submission wasnt successful, keep modals state as it is
      return
    }

    if (evt.target.tagName === 'FORM') {
      form = evt.target
    } else {
      form = evt.target.closest('form')
    }

    if (!form) {
      return
    }

    // form submission was successful within this modal -> close it
    evt.detail.formSubmission.stop()
    this.close(evt)
  }

  /**
   * When modal closed, the modal raises the event *modal:closed* to the element, which
   * opened the modal originally. Some opener elements needs this information to perform
   * appropriate actions.
   * @param {Boolean} cancelled Indicates if the modal was closed via cancel (close / escape),
   *                            or if it was automatically closed, due to a successful and
   *                            finished data manipulation.
   */
  notifyOpenerAboutClose(cancelled) {
    if (!this.popupOpener) {
      return
    }

    const notificationEvent = new CustomEvent('modal:closed', { detail: { cancelled: cancelled, modalOriginator: this.popupOpener } })

    this.popupOpener.dispatchEvent(notificationEvent)
  }

  template() {
    return `
      <div data-popup-target="container" class="modal fade" data-backdrop="static" tabindex="-1" role="dialog" aria-labelledby="staticBackdrop" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header" data-popup-target="header">
              <h5 class="modal-title">${this.heading}</h5>

              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <i aria-hidden="true" class="fas fa-times"></i>
              </button>
            </div>

            <div class="modal-body" data-popup-target="content">
              <span class="spinner-border text-secondary"></span>
            </div>
          </div>
        </div>
      </div>
    `
  }
}
