class Blog < ApplicationRecord
  validates :title, length: { minimum: 4 }
end
