class ApplicationController < ActionController::Base
  layout :layout_by_resource

  def layout_by_resource
    return false if request.xhr? || turbo_frame_request?
  end
end
