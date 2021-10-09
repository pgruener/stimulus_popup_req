module ApplicationHelper
  def link_to_popup(label, url, **args)
    popup_args = {
      data: {
        controller: 'popup',
        popup_url: url,
        action: 'click->popup#openModal keydown@window->popup#closeWithKeyboard',
      }
    }

    link_to(label, url, args.merge(popup_args))
  end
end
