-- Create download tables
CREATE TABLE IF NOT EXISTS `download` (
  `download_id` INT(11) NOT NULL AUTO_INCREMENT,
  `filename` VARCHAR(160) NOT NULL,
  `mask` VARCHAR(128) NOT NULL,
  `date_added` DATETIME NOT NULL,
  PRIMARY KEY (`download_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `download_description` (
  `download_id` INT(11) NOT NULL,
  `language_id` INT(11) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`download_id`,`language_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `product_to_download` (
  `product_id` INT(11) NOT NULL,
  `download_id` INT(11) NOT NULL,
  PRIMARY KEY (`product_id`,`download_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;